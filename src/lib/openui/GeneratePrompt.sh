#!/bin/zsh
# run this shell script to generate the system prompt for the OpenUI library

npx @openuidev/cli@latest generate ./library.ts --out system-prompt.txt

python escape_js_template.py system-prompt.txt -o system-prompt.ts