import argparse

def escape_template_string(text: str, escape_dollar: bool = False) -> str:
    # 转义反引号
    text = text.replace("`", r"\`")

    # 可选：转义 ${ 防止 JS 模板字符串插值
    if escape_dollar:
        text = text.replace("${", r"\${}")

    return text


def main():
    parser = argparse.ArgumentParser(description="Escape JS template string content")
    parser.add_argument("input", help="Input file")
    parser.add_argument("-o", "--output", help="Output file (optional)")
    parser.add_argument("--escape-dollar", action="store_true", help="Escape ${ to avoid template interpolation")

    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        content = f.read()

    escaped = f"const OPENUI_SYSTEM_PROMPT = `{escape_template_string(content, args.escape_dollar)}`;\nexport default OPENUI_SYSTEM_PROMPT;"

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            print("format '`' sucessfully, saved to", args.output)
            f.write(escaped)
    else:
        print(escaped)


if __name__ == "__main__":
    main()