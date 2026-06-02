import sys 
def fix_file(path): 
    with open(path, 'rb') as f: 
        data = f.read() 
    # Check for UTF-8 BOM 
