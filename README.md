# TRaVeLiNG Tools

Allows you to create any board pass barcode using a simple web interface:

With this you can do what this guy does here:  
http://gizmodo.com/hacker-builds-a-qr-code-generator-that-lets-him-into-fa-1784884083

This software was created using freely available resources.  

This tool is intended for educational purposes only, use at your own personal risk.  

## GitHub Pages

This repository is configured to auto-deploy to GitHub Pages via GitHub Actions.

### First-time setup

1. Open repository settings on GitHub.
2. Go to **Pages**.
3. Set **Source** to **GitHub Actions**.

After this one-time setup, every push to `main` automatically builds and deploys the site.

Workflow file:
- `.github/workflows/deploy-pages.yml`

### Manual deploy trigger

You can also open **Actions** and run **Deploy to GitHub Pages** manually via `workflow_dispatch`.


### Aztec barcode  
https://en.wikipedia.org/wiki/Aztec_Code  
https://github.com/zint/zint  

### BCBP standard (the data that goes into a boarding pass)
http://www.iata.org/whatwedo/stb/documents/bcbp_implementation_guidev4_jun2009.pdf  
https://shaun.net/whats-contained-in-a-boarding-pass-barcode/  

### Other useful info  
Airline codes  
http://www.airlineandairportlinks.com/frameset_linecode.html  
International Air Transport Association airport code     
http://www.airportcodes.org/
