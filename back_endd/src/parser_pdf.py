# parser_pdf.py
import sys, json, re
from PyPDF2 import PdfReader

def parse_brl_number(s: str):
    s = str(s).strip()
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except:
        return 0.0

def extrair_produtos(pdf_path):
    reader = PdfReader(pdf_path)
    texto = ""
    for pagina in reader.pages:
        texto += pagina.extract_text() or ""

    # Regex genérico para: CODIGO - DESCRICAO UN QTD VALOR_UNIT TOTAL
    padrao = re.compile(
        r"(\d{3,7})\s*-\s*([A-Z0-9\s\.,\-\/]+?)\s+([A-Z]{1,5})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)",
        re.MULTILINE
    )

    produtos = []
    for match in padrao.finditer(texto):
        produtos.append({
            "materialCode": match.group(1).strip(),
            "materialName": match.group(2).strip(),
            "unit": match.group(3).lower(),
            "qty": parse_brl_number(match.group(4)),
            "unitCost": parse_brl_number(match.group(5)),
            "total": parse_brl_number(match.group(6))
        })

    return produtos

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    produtos = extrair_produtos(pdf_path)
    print(json.dumps(produtos, ensure_ascii=False))
