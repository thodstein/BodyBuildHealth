import sys
import docx
import os

def extract_text_from_docx(path):
    doc = docx.Document(path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python extract_docx.py <docx_file> <output_txt_file>")
        sys.exit(1)
    docx_path = sys.argv[1]
    txt_path = sys.argv[2]
    if not os.path.exists(docx_path):
        print(f"File not found: {docx_path}")
        sys.exit(1)
    try:
        text = extract_text_from_docx(docx_path)
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Extracted text saved to {txt_path}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
