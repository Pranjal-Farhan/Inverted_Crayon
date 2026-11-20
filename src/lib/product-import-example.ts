// A valid example of the import JSON. Kept apart from src/lib/product-import.ts so the import page
// can show it without shipping the whole converter (and zod) to the browser. Keep it valid: after
// changing the format, paste it into the import page and check it still previews as Ready.

export const IMPORT_EXAMPLE = `{
  "products": [
    {
      "title": "The Scribble Jacket",
      "slug": "the-scribble-jacket",
      "gender": "WOMEN",
      "category": "Outerwear",
      "price": 3000,
      "salePrice": 2500,
      "mood": "Outside the lines on purpose. A cropped, oversized bomber with a balloon hem.",
      "build": [
        "Cropped, oversized cut with a balloon hem",
        "Fabric: Suede"
      ],
      "howToWear": [
        "Throw it over a plain tee for campus days and late nights.",
        "Pair it with straight jeans and chunky sneakers."
      ],
      "seoTitle": "The Scribble Jacket | Inverted Crayon",
      "seoDescription": "Cropped balloon-hem bomber. Preorder The Scribble Jacket.",
      "tags": ["NEW", "PREORDER"],
      "skuPattern": "SCRIB-{COLOR}-{SIZE}",
      "stock": 0,
      "preorderAdvance": 0,
      "colors": [
        { "name": "Camel", "hex": "#C19A6B", "code": "CAM" },
        { "name": "Black", "hex": "#111111", "code": "BLA" }
      ]
    }
  ]
}`;
