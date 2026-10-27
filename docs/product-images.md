# Product images

ProductVault uses two image paths:

- **Invoice upload:** after OCR, the server checks for a labeled UPC/EAN/GTIN (or another checksum-valid GTIN) in the extracted text. For a signed-in user, it sends only that barcode to UPCitemDB's unauthenticated trial lookup. If the catalog returns a secure image URL, the review screen shows it before the product is saved.
- **Manual entry or no catalog match:** the app displays a bundled illustration based on the product name/category. These illustrations load locally and need no API, key, or network request. A toy car gets a toy-car illustration; headphones get a headphone illustration.

The lookup uses UPCitemDB's free trial endpoint and needs no API key. Its free quota is shared by requests from the server's IP, so the app makes at most one lookup per invoice, caches responses for 24 hours, and treats rate limits, timeouts, invalid barcodes, and missing matches as normal fallback cases. The invoice file and OCR text are never sent to the catalog provider. The catalog image is optional enrichment; it cannot block review or saving.

This first version can recognize a barcode when OCR reads its printed digits. It does not decode a barcode graphic when no human-readable digits are present. In that case, the local category illustration is used.

References: [UPCitemDB API](https://www.upcitemdb.com/api/), [trial plan limits](https://www.upcitemdb.com/wp/docs/main/development/plan/), [lookup response format](https://www.upcitemdb.com/wp/docs/main/development/responses/).
