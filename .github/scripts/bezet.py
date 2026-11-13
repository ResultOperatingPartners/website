"""Maakt _site/assets/bezet.json: alleen begin- en eindtijden van bezette momenten
uit de gepubliceerde Outlook-agenda (geen onderwerpen, namen of locaties)."""
import json, os, sys, urllib.request
from datetime import datetime, timedelta, timezone

uit = sys.argv[1]
url = os.environ.get("AGENDA_ICS_URL", "").strip()
blokken = []
if url:
    import icalendar, recurring_ical_events
    data = urllib.request.urlopen(url, timeout=30).read()
    cal = icalendar.Calendar.from_ical(data)
    nu = datetime.now(timezone.utc)
    for ev in recurring_ical_events.of(cal).between(nu - timedelta(days=1), nu + timedelta(days=75)):
        if str(ev.get("TRANSP", "")).upper() == "TRANSPARENT" or str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        s = ev.decoded("DTSTART")
        e = ev.decoded("DTEND") if ev.get("DTEND") else None
        if not isinstance(s, datetime):  # hele dag: de hele (Nederlandse) dag blokkeren
            s = datetime(s.year, s.month, s.day, tzinfo=timezone.utc) - timedelta(hours=2)
            e = s + timedelta(days=1, hours=2)
        if e is None:
            e = s + timedelta(minutes=30)
        if s.tzinfo is None:
            s = s.replace(tzinfo=timezone.utc)
            e = e.replace(tzinfo=timezone.utc)
        blokken.append([int(s.timestamp() * 1000), int(e.timestamp() * 1000)])
    blokken.sort()
os.makedirs(os.path.dirname(uit), exist_ok=True)
json.dump({"bijgewerkt": datetime.now(timezone.utc).isoformat(timespec="minutes"), "bezet": blokken}, open(uit, "w"))
print(len(blokken), "bezette blokken")
