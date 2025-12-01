import * as vscode from "vscode";
import { GenericOutlineProvider } from "./genericOutlineProvider";
import { OutlineItem } from "./outlineItem";

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
   * Parses headings (H1-H6) using regex patterns.
   */
  private parseMarkdownDirectly(document: vscode.TextDocument): OutlineItem[] {
    const items: OutlineItem[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/;

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const match = headingRegex.exec(line.text);

      if (match) {
        const level = match[1].length; // Number of # characters
        const text = match[2].trim();

        // Create range for this heading
        const startPos = new vscode.Position(i, 0);
        const endPos = new vscode.Position(i, line.text.length);
        const range = new vscode.Range(startPos, endPos);

        // Map heading level to symbol kind
        const symbolKind =
          level === 1 ? vscode.SymbolKind.File : vscode.SymbolKind.String;

        const item = new OutlineItem(
          text,
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
