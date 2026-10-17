"""Builds index.html from the files in src/.

Usage:  python3 build.py

src/shell.html holds the page (title, styles, markup). Every src/*.js file is
joined in name order into one script, so the numeric prefixes set the order.
"""
import base64, pathlib, re

root = pathlib.Path(__file__).parent
src = root / 'src'
shell = (src / 'shell.html').read_text(encoding='utf-8')
js = '\n'.join(p.read_text(encoding='utf-8') for p in sorted(src.glob('*.js')))
body = shell + '\n<script>\n(() => {\n"use strict";\n' + js + '\n})();\n</script>\n'

m = re.match(r'(<title>.*?</title>\s*<link[^>]*>\s*<style>.*?</style>)(.*)', body, re.S)
head, rest = m.group(1), m.group(2)
# The tab icon: the triangle with its eye, drawn inline so the page stays one file.
icon = base64.b64encode(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 3L62 59H2z" fill="#6d1fb0" stroke="#ff5fa2" stroke-width="3" stroke-linejoin="round"/>'
                        b'<path d="M14 41q18-16 36 0q-18 16-36 0z" fill="#2a8fb8"/><circle cx="32" cy="41" r="7.5" fill="#f4f1ff"/><circle cx="33" cy="42" r="4" fill="#111"/></svg>').decode()
doc = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<meta name="theme-color" content="#05040a">\n<meta name="mobile-web-app-capable" content="yes">\n'
       '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
       '<link rel="icon" href="data:image/svg+xml;base64,' + icon + '">\n'
       + head + '\n<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>' + rest + '</body>\n</html>\n')
(root / 'index.html').write_text(doc, encoding='utf-8')
print('built index.html,', len(doc.encode('utf-8')), 'bytes')
