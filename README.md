# Birthday Surprise Web App

This is the web version of the original Tkinter Python project.

## Files

- `index.html` — QR generator page
- `surprise.html` — birthday surprise page
- `style.css` — styling
- `app.js` — photo selection, QR generation, export and surprise opening

## Run locally

Open the folder with a local web server. For example:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

## Deploy on GitHub Pages

1. Create a GitHub repository.
2. Upload these four files plus README.md.
3. Go to Settings → Pages.
4. Select Deploy from branch.
5. Select `main` and `/root`.
6. Save.
7. GitHub will give you the public website URL.

## Important

The QR code contains the selected image as a data URL, so the generated link can become very large for high-resolution photos. For reliable sharing, resize/compress large photos before generating the QR.

The QR service used by this version is an external QR image API. If you want a completely self-contained version with no third-party QR service, replace it with a JavaScript QR library.
