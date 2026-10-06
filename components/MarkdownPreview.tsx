import type { ReactNode } from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";

const INK = "#101D38";
const MUTED = "#75829C";
const BLUE = "#1749E8";
const LINE = "#E5EAF3";

export function MarkdownPreview({ title, markdown }: { title: string; markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (/^\s*```/.test(line)) {
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<View key={`code-${index}`} style={styles.codeBlock}><Text selectable style={styles.codeText}>{code.join("\n")}</Text></View>);
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push(<Text key={`heading-${index}`} style={[styles.heading, { fontSize: Math.max(18, 27 - heading[1].length * 2), lineHeight: Math.max(24, 33 - heading[1].length * 2) }]}>{inlineMarkdown(heading[2], `h-${index}`)}</Text>);
      index += 1;
      continue;
    }

    const image = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (image) {
      blocks.push(<Image key={`image-${index}`} source={{ uri: image[2] }} accessibilityLabel={image[1]} resizeMode="contain" style={styles.image} />);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) rows.push(splitTableRow(lines[index++]));
      blocks.push(<ScrollView key={`table-${index}`} horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={styles.tableScroller}>
        <View style={styles.table}>
          <View style={styles.tableRow}>{headers.map((cell, cellIndex) => <View key={`head-${cellIndex}`} style={[styles.tableCell, styles.tableHeadCell]}><Text style={styles.tableHeadText}>{inlineMarkdown(cell.trim(), `th-${index}-${cellIndex}`)}</Text></View>)}</View>
          {rows.map((row, rowIndex) => <View key={`row-${rowIndex}`} style={styles.tableRow}>{headers.map((_, cellIndex) => <View key={`cell-${cellIndex}`} style={styles.tableCell}><Text style={styles.tableCellText}>{inlineMarkdown((row[cellIndex] ?? "").trim(), `td-${index}-${rowIndex}-${cellIndex}`)}</Text></View>)}</View>)}
        </View>
      </ScrollView>);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*>\s?(.*)$/);
        if (!match) break;
        quoteLines.push(match[1]);
        index += 1;
      }
      blocks.push(<View key={`quote-${index}`} style={styles.quoteBlock}><Text style={styles.quoteText}>{quoteLines.map((quoteLine, quoteIndex) => <Text key={quoteIndex}>{inlineMarkdown(quoteLine, `q-${index}-${quoteIndex}`)}{quoteIndex < quoteLines.length - 1 ? "\n" : ""}</Text>)}</Text></View>);
      continue;
    }

    const list = line.match(/^\s*(?:([-+*])\s+|((?:\d+)[.)])\s+)(.*)$/);
    if (list) {
      const itemLines: { marker: string; text: string; task?: boolean }[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*(?:([-+*])\s+|((?:\d+)[.)])\s+)(.*)$/);
        if (!match) break;
        const task = match[3].match(/^\[([ xX])\]\s*(.*)$/);
        itemLines.push({ marker: match[2] ?? "•", text: task ? task[2] : match[3], task: task ? task[1].toLowerCase() === "x" : undefined });
        index += 1;
      }
      blocks.push(<View key={`list-${index}`} style={styles.listBlock}>{itemLines.map((item, itemIndex) => <View key={itemIndex} style={styles.listItem}><Text style={styles.listMarker}>{item.task === undefined ? item.marker : item.task ? "☑" : "☐"}</Text><Text style={styles.paragraph}>{inlineMarkdown(item.text, `list-${index}-${itemIndex}`)}</Text></View>)}</View>);
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<View key={`rule-${index}`} style={styles.rule} />);
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index], lines[index + 1])) paragraph.push(lines[index++]);
    blocks.push(<Text key={`paragraph-${index}`} style={styles.paragraph}>{paragraph.map((paragraphLine, paragraphIndex) => <Text key={paragraphIndex}>{inlineMarkdown(paragraphLine, `p-${index}-${paragraphIndex}`)}{paragraphIndex < paragraph.length - 1 ? "\n" : ""}</Text>)}</Text>);
  }

  if (!blocks.length) blocks.push(<Text key="empty" style={styles.empty}>Your formatted note will appear here.</Text>);

  return <View style={styles.preview}>
    {!!title.trim() && <Text style={styles.title}>{title.trim()}</Text>}
    {blocks}
  </View>;
}

function isBlockStart(line: string, next?: string) {
  return /^\s*(?:#{1,6}\s|```|!\[|>|[-+*]\s|\d+[.)]\s|---+\s*$|___+\s*$|\*\*\*+\s*$)/.test(line)
    || (!!next && line.includes("|") && isTableDivider(next));
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

function inlineMarkdown(text: string, key: string): ReactNode[] {
  const tokens = /(\*\*[^*]+\*\*|__.+?__|~~.+?~~|`[^`]+`|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  return text.split(tokens).filter((part) => part !== "").map((part, index) => {
    const tokenKey = `${key}-${index}`;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <Text key={tokenKey} style={styles.bold}>{part.slice(2, -2)}</Text>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <Text key={tokenKey} style={styles.strike}>{part.slice(2, -2)}</Text>;
    if (part.startsWith("*") && part.endsWith("*") || part.startsWith("_") && part.endsWith("_")) return <Text key={tokenKey} style={styles.italic}>{part.slice(1, -1)}</Text>;
    if (part.startsWith("`") && part.endsWith("`")) return <Text key={tokenKey} style={styles.inlineCode}>{part.slice(1, -1)}</Text>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Text key={tokenKey} style={styles.link} onPress={() => { void Linking.openURL(link[2]).catch(() => undefined); }}>{link[1]}</Text>;
    return part;
  });
}

const styles = StyleSheet.create({
  preview: { paddingTop: 3, paddingBottom: 24 },
  title: { color: INK, fontSize: 27, lineHeight: 34, fontWeight: "700", letterSpacing: -0.7, marginBottom: 19 },
  heading: { color: INK, fontWeight: "700", letterSpacing: -0.45, marginTop: 15, marginBottom: 7 },
  paragraph: { color: "#34415B", fontSize: 17, lineHeight: 27, marginBottom: 13 },
  bold: { color: INK, fontWeight: "800" }, italic: { fontStyle: "italic" }, strike: { textDecorationLine: "line-through" },
  inlineCode: { color: "#163FB3", backgroundColor: "#EAF0FF", fontFamily: "monospace" },
  link: { color: BLUE, textDecorationLine: "underline" },
  quoteBlock: { borderLeftWidth: 3, borderLeftColor: BLUE, paddingLeft: 15, marginVertical: 10 }, quoteText: { color: MUTED, fontSize: 16, lineHeight: 25, fontStyle: "italic" },
  listBlock: { marginVertical: 3 }, listItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 }, listMarker: { width: 27, color: BLUE, fontSize: 16, lineHeight: 26, fontWeight: "700" },
  codeBlock: { backgroundColor: "#101D38", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13, marginVertical: 7 }, codeText: { color: "#F3F6FD", fontFamily: "monospace", fontSize: 14, lineHeight: 21 },
  image: { width: "100%", height: 230, marginVertical: 9, borderRadius: 12, backgroundColor: "#EEF2FA" },
  tableScroller: { marginVertical: 9 }, table: { borderWidth: 1, borderColor: LINE, borderRadius: 12, overflow: "hidden" }, tableRow: { flexDirection: "row" }, tableCell: { minWidth: 108, maxWidth: 220, paddingHorizontal: 12, paddingVertical: 9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE }, tableHeadCell: { backgroundColor: "#EEF3FF" }, tableHeadText: { color: INK, fontSize: 13, fontWeight: "800" }, tableCellText: { color: "#34415B", fontSize: 14, lineHeight: 20 },
  rule: { height: 1, backgroundColor: LINE, marginVertical: 14 }, empty: { color: MUTED, fontSize: 15, lineHeight: 23, fontStyle: "italic" },
});
