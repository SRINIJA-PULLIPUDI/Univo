import sys
import os
import json
import pymupdf

def render_pages(pdf_path, out_dir, max_pages=10, dpi=150):
    try:
        doc = pymupdf.open(pdf_path)
        total_pages = len(doc)
        pages_to_render = min(total_pages, max_pages)
        rendered_images = []

        os.makedirs(out_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]

        for i in range(pages_to_render):
            page = doc[i]
            pix = page.get_pixmap(dpi=dpi)
            img_path = os.path.join(out_dir, f"{base_name}_page_{i+1}.png")
            pix.save(img_path)
            rendered_images.append({
                "page": i + 1,
                "imagePath": img_path
            })

        print(json.dumps({
            "success": True,
            "totalPages": total_pages,
            "renderedCount": len(rendered_images),
            "pages": rendered_images
        }))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python render_pdf_pages.py <pdf_path> <out_dir> [max_pages]"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    render_pages(pdf_path, out_dir, max_pages)
