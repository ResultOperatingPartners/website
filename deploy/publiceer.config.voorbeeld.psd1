# Voorbeeld. Kopieer naar publiceer.config.psd1 (staat niet in GitHub) en vul in.
@{
    # Gegevens van je TransIP-webhosting (te vinden in het TransIP-controlepaneel
    # onder Webhosting > SFTP/SSH). Dit zijn GEEN geheimen: zonder jouw
    # SSH-sleutel en jouw IP-adres kan niemand er iets mee.
    Server     = 'VUL-IN.transip.nl'   # bijv. de SSH/SFTP-hostnaam uit het controlepaneel
    Gebruiker  = 'VUL-IN'              # SFTP-gebruikersnaam
    Poort      = 22

    # Je SSH-sleutel (alleen op deze laptop). Zie TRANSIP.md, stap 3.
    Sleutel    = '%USERPROFILE%\.ssh\resultop_transip'

    # Mappen op de server
    MapWebsite = 'www'
    MapPrivaat = 'private'

    # Alleen deze IP-adressen mogen de beheerpagina openen.
    # Losse adressen of bereiken, bijv. @('203.0.113.10', '2001:db8:1234::/48').
    BeheerIPs  = @('0.0.0.0')   # <-- vervang door je eigen IP-adres(sen)
}
