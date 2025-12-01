import * as vscode from "vscode";
import { GenericOutlineProvider } from "./genericOutlineProvider";
import { OutlineItem } from "./outlineItem";
import MarkdownIt from "markdown-it";

/**
 * Markdown-specific outline provider.
 * Extends GenericOutlineProvider with markdown-specific symbol name sanitization
 * and level mapping for heading hierarchies.
 *
 * PI-2: Builds hierarchical tree based on heading levels (H1-H6)
 */
export class MarkdownOutlineProvider extends GenericOutlineProvider {
  /**
   * Override parseDocument to add fallback direct markdown parsing
   * when symbol provider is not available (e.g., for "emd" language).
   */
  protected async parseDocument(
    document: vscode.TextDocument
  ): Promise<OutlineItem[]> {
    // First try the standard symbol provider approach
    const symbols = await super.parseDocument(document);

    // If we got symbols, return them
    if (symbols.length > 0) {
      return symbols;
    }

    // Fallback: parse markdown directly using regex
    return this.parseMarkdownDirectly(document);
  }

  /**
   * Direct markdown parsing for languages without symbol provider.
   * Uses markdown-it parser for CommonMark-compliant parsing.
   */
  private parseMarkdownDirectly(document: vscode.TextDocument): OutlineItem[] {
    const items: OutlineItem[] = [];
    const md = new MarkdownIt();
    const text = document.getText();

    // Parse markdown and extract headings
    const tokens = md.parse(text, {});

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // markdown-it uses 'heading_open' token for headings
      if (token.type === "heading_open") {
        const level = parseInt(token.tag.substring(1), 10); // Extract number from 'h1', 'h2', etc.

        // Find the corresponding inline token with the heading text (usually next token)
        let headingText = "";
        if (i + 1 < tokens.length && tokens[i + 1].type === "inline") {
          headingText = this.extractTextFromInlineToken(tokens[i + 1]);
        }

        // token.map contains [startLine, endLine] in 0-based indexing
        // Convert to 1-based line numbers for VS Code (map[0] is the line number)
        const lineNumber = token.map ? token.map[0] : 0;
        const line = document.lineAt(lineNumber);

        // Create range for this heading
        const startPos = new vscode.Position(lineNumber, 0);
        const endPos = new vscode.Position(lineNumber, line.text.length);
        const range = new vscode.Range(startPos, endPos);

        // Map heading level to symbol kind
        const symbolKind =
          level === 1 ? vscode.SymbolKind.File : vscode.SymbolKind.String;

        const item = new OutlineItem(
          headingText.trim(),
          level,
          range,
          range,
          [],
          symbolKind,
          document
        );

        items.push(item);
      }
    }

    // Build hierarchy from flat list
    return this.buildHierarchy(items);
  }

  /**
   * Recursively extracts text content from markdown-it inline token.
   */
  private extractTextFromInlineToken(token: any): string {
    if (token.type === "text") {
      return token.content;
    }

    if (token.children) {
      return token.children
        .map((child: any) => this.extractTextFromInlineToken(child))
        .join("");
    }

    return "";
  }

  /**
   * Removes # prefix from heading text returned by built-in markdown parser.
   * Trims whitespace from the result.
   *
   * @param text - Heading text (may include # prefix)
   * @returns Clean heading text without # prefix
   */
  protected sanitizeSymbolName(text: string): string {
    const match = /^#{1,6}\s+(.+)$/.exec(text);
    return match ? match[1].trim() : text.trim();
  }

  /**
   * Extracts heading level from a markdown symbol.
   * Maps markdown heading symbols to levels 1-6.
   *
   * The built-in markdown parser uses:
   * - SymbolKind.File for H1
   * - SymbolKind.String for H2-H6 (with # prefix in name)
   *
   * @param symbol - Symbol to extract level from
   * @returns Heading level (1-6)
   */
  protected getLevelFromSymbol(
    symbol: vscode.SymbolInformation | vscode.DocumentSymbol
  ): number {
    // Built-in markdown parser uses File for H1 and String for H2-H6
    switch (symbol.kind) {
      case vscode.SymbolKind.File:
        return 1;

      case vscode.SymbolKind.String: {
        // Try to determine level from name (# prefix count)
        const match = /^(#{1,6})\s/.exec(symbol.name);
        if (match) {
          return match[1].length;
        }
        // Default to level 2 if can't determine
        return 2;
      }

      // Fallback to generic mapping for other symbol kinds
      default:
        return super.getLevelFromSymbol(symbol);
    }
  }
}
