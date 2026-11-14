#!/usr/bin/env python3
"""
Lokale website-editor voor Result Operating Partners.
=======================================================
Start dit script vanaf je computer (niet in de cloud) om de site
"als een soort PowerPoint" te bewerken: tekst aanklikken en typen,
lettergrootte/breedte aanpassen, volgorde slepen. Publiceren maakt
een pull request aan op GitHub, die je zelf goedkeurt/merget.

Gebruik:
    cd pad/naar/website        (de map met index.html, .git, enz.)
    python3 tools/editor/server.py
    -> open de link die verschijnt (meestal http://localhost:8787)

Elke pagina is te bewerken door ?bewerken=1 aan het adres toe te
voegen (dat doet het menu op de startpagina al voor je), bijvoorbeeld
http://localhost:8787/afspraak/?bewerken=1

Vereisten: Python 3 (zit standaard op macOS) en git, met je eigen
push-rechten op deze repository (dezelfde manier waarop je nu al
met git/GitHub werkt op deze computer).
"""
import http.server
import json
import mimetypes
import os
import re
import socketserver
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

PORT = 8787
REPO_ROOT = Path(__file__).resolve().parents[2]
EDITOR_DIR = Path(__file__).resolve().parent
EXCLUDE_DIRS = {".git", "node_modules", "tools"}


def vind_html_paginas():
    """Alle .html-bestanden in de site, met het pad t.o.v. de hoofdmap."""
    paginas = []
    for pad in REPO_ROOT.rglob("*.html"):
        relatief = pad.relative_to(REPO_ROOT)
        if any(deel in EXCLUDE_DIRS for deel in relatief.parts):
            continue
        paginas.append(str(relatief).replace(os.sep, "/"))
    return sorted(paginas)


def resolve_statisch(url_pad):
    """Zet een URL-pad om naar een bestand bínnen de repo; weigert ontsnappogingen.
    Volgt dezelfde regel als GitHub Pages: een pad dat op '/' eindigt (of leeg is)
    wijst naar index.html in die map, zodat relatieve links (assets/..., afspraak/...)
    precies zo werken als op de live site."""
    schoon = unquote(url_pad).lstrip("/")
    if schoon == "" or schoon.endswith("/"):
        schoon += "index.html"
    kandidaat = (REPO_ROOT / schoon).resolve()
    if REPO_ROOT not in kandidaat.parents and kandidaat != REPO_ROOT:
        return None
    if any(deel in EXCLUDE_DIRS for deel in Path(schoon).parts):
        return None
    return kandidaat


EDITOR_SCRIPT_TAG = '<script src="/__editor/overlay.js" data-editor-script defer></script>'


def injecteer_editor(html):
    # Geen inline <script>: de site gebruikt een Content-Security-Policy die inline
    # scripts blokkeert. De editor haalt zijn eigen pagina op uit location.pathname.
    if "</body>" in html:
        return html.replace("</body>", EDITOR_SCRIPT_TAG + "\n</body>", 1)
    return html + EDITOR_SCRIPT_TAG


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "ROPEditor/2.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("  " + (fmt % args) + "\n")

    # ---- GET ----
    def do_GET(self):
        parsed = urlparse(self.path)
        pad = parsed.path
        query = parse_qs(parsed.query)

        if pad == "/__editor/" or pad == "/__editor":
            return self._menu()
        if pad == "/__editor/overlay.js":
            return self._stuur_bestand(EDITOR_DIR / "overlay.js", "application/javascript")

        bestand = resolve_statisch(pad)
        if bestand is None or not bestand.is_file():
            self.send_error(404, "Niet gevonden")
            return

        if bestand.suffix == ".html" and "bewerken" in query:
            html = bestand.read_text(encoding="utf-8")
            html = injecteer_editor(html)
            return self._stuur_tekst(html, "text/html; charset=utf-8")

        ctype = mimetypes.guess_type(str(bestand))[0] or "application/octet-stream"
        self._stuur_bestand(bestand, ctype)

    def _stuur_bestand(self, pad, ctype):
        try:
            data = pad.read_bytes()
        except OSError:
            self.send_error(404, "Niet gevonden")
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _stuur_tekst(self, tekst, ctype):
        data = tekst.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _menu(self):
        paginas = vind_html_paginas()
        items = "".join(
            '<li><a href="/%s?bewerken=1">%s</a> <span style="color:#888">(/%s)</span></li>'
            % (p, p, ("" if p == "index.html" else p.rsplit("/", 1)[0] + "/"))
            for p in paginas
        )
        html = """<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<title>Website-editor — Result Operating Partners</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#14213d}
a{color:#14213d}li{margin:8px 0;font-size:17px}h1{font-size:22px}</style></head>
<body><h1>Welke pagina wil je bewerken?</h1><ul>%s</ul>
<p style="color:#666;font-size:14px">Lokale editor — wijzigingen worden pas live na jouw goedkeuring op GitHub.</p>
</body></html>""" % items
        self._stuur_tekst(html, "text/html; charset=utf-8")

    # ---- POST ----
    def do_POST(self):
        pad = urlparse(self.path).path
        lengte = int(self.headers.get("Content-Length", 0))
        ruw = self.rfile.read(lengte) if lengte else b"{}"
        try:
            body = json.loads(ruw.decode("utf-8"))
        except Exception:
            return self._json(400, {"ok": False, "error": "Ongeldig verzoek."})

        if pad == "/__save":
            return self._opslaan(body)
        if pad == "/__publish":
            return self._publiceren(body)
        self.send_error(404)

    def _json(self, status, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _opslaan(self, body):
        relatief = (body.get("path") or "").strip()
        html = body.get("html") or ""
        if not relatief or not relatief.endswith(".html") or not html.strip():
            return self._json(400, {"ok": False, "error": "Ontbrekende of ongeldige gegevens (pagina: '%s')." % relatief})
        bestand = (REPO_ROOT / relatief).resolve()
        if REPO_ROOT not in bestand.parents or not bestand.is_file():
            return self._json(400, {"ok": False, "error": "Onbekende pagina: " + relatief})
        if not html.lstrip().lower().startswith("<!doctype"):
            return self._json(400, {"ok": False, "error": "Geen geldige HTML ontvangen."})
        bestand.write_text(html, encoding="utf-8")
        return self._json(200, {"ok": True})

    def _publiceren(self, body):
        notitie = (body.get("message") or "").strip() or "Teksten aangepast via de lokale editor"

        def git(*args, mag_falen=False):
            r = subprocess.run(["git", "-C", str(REPO_ROOT), *args], capture_output=True, text=True)
            if r.returncode != 0 and not mag_falen:
                raise RuntimeError((r.stderr or r.stdout).strip())
            return r.stdout.strip()

        try:
            status = git("status", "--porcelain")
            gewijzigd = [
                regel[3:] for regel in status.splitlines()
                if regel[:2].strip() in ("M", "MM", "A", "AM") and regel[3:].endswith(".html")
            ]
            if not gewijzigd:
                return self._json(200, {"ok": False, "error": "Geen wijzigingen om te publiceren. Sla eerst iets op."})

            huidige = git("rev-parse", "--abbrev-ref", "HEAD")
            tak = "site-wijziging-" + time.strftime("%Y%m%d-%H%M%S")
            git("checkout", "-b", tak)
            git("add", "--", *gewijzigd)
            git("commit", "-m", notitie)
            git("push", "-u", "origin", tak)

            remote = git("remote", "get-url", "origin", mag_falen=True)
            m = re.search(r"github\.com[:/]+([^/]+)/([^/.]+)", remote or "")
            url = None
            if m:
                owner, repo = m.group(1), m.group(2)
                basis = huidige if huidige != tak else "main"
                url = "https://github.com/%s/%s/compare/%s...%s?expand=1" % (owner, repo, basis, tak)
                try:
                    webbrowser.open(url)
                except Exception:
                    pass

            git("checkout", huidige, mag_falen=True)
            return self._json(200, {"ok": True, "url": url, "branch": tak, "files": gewijzigd})
        except Exception as e:
            return self._json(200, {"ok": False, "error": str(e)})


class StillServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    if not (REPO_ROOT / ".git").exists():
        print("Let op: %s lijkt geen git-repository. Start dit script vanuit je lokale kloon van de website." % REPO_ROOT)
    server = StillServer(("127.0.0.1", PORT), Handler)
    url = "http://localhost:%d/__editor/" % PORT
    print("Website-editor draait op %s" % url)
    print("Sluiten met Ctrl+C.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGestopt.")


if __name__ == "__main__":
    main()
