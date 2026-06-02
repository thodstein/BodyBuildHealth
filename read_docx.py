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
    if len(sys.argv) < 2:
        print("Usage: python read_docx.py <docx_file>")
        sys.exit(1)
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)
    try:
        text = extract_text_from_docx(file_path)
        print(text)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
