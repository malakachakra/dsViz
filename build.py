"""Builds index.html from the files in src/.

Usage:  python3 build.py

src/shell.html holds the page (title, styles, markup). Every src/*.js file is
joined in name order into one script, so the numeric prefixes set the order.
"""
import pathlib, re

root = pathlib.Path(__file__).parent
src = root / 'src'
shell = (src / 'shell.html').read_text(encoding='utf-8')
js = '\n'.join(p.read_text(encoding='utf-8') for p in sorted(src.glob('*.js')))
body = shell + '\n<script>\n(() => {\n"use strict";\n' + js + '\n})();\n</script>\n'

m = re.match(r'(<title>.*?</title>\s*<link[^>]*>\s*<style>.*?</style>)(.*)', body, re.S)
head, rest = m.group(1), m.group(2)
doc = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + head + '\n<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>' + rest + '</body>\n</html>\n')
(root / 'index.html').write_text(doc, encoding='utf-8')
print('built index.html,', len(doc.encode('utf-8')), 'bytes')
