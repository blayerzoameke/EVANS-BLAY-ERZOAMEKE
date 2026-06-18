
import React, { useState } from 'react';
import { Download, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import katex from 'katex';

export interface TableData {
    title?: string;
    headers: string[];
    rows: string[][];
    caption?: string;
}

interface TableRendererProps {
    data: TableData;
    className?: string;
}

/**
 * Parses a raw markdown string into a TableData object.
 * Expects a standard markdown table format.
 */
export const parseMarkdownTable = (markdown: string): TableData | null => {
    const lines = markdown.trim().split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return null;

    // Check for separator row (usually the second row, contains ---)
    const separatorIndex = lines.findIndex(line => /^\|?\s*[-:]+(\s*\|\s*[-:]+)*\s*\|?$/.test(line));
    
    if (separatorIndex === -1) return null;

    // Helper to split a line by pipe, handling escaped pipes if necessary (simple split for now)
    // Also handles leading/trailing pipes which are optional in markdown
    const parseRow = (row: string) => {
        // Remove leading/trailing pipes if they exist
        let content = row;
        if (content.startsWith('|')) content = content.substring(1);
        if (content.endsWith('|')) content = content.substring(0, content.length - 1);
        
        return content.split('|').map(cell => cell.trim());
    };

    const headers = parseRow(lines[0]);
    
    // Process data rows (skipping the header and the separator)
    const rows = lines.slice(separatorIndex + 1).map(line => parseRow(line));

    // Basic validation: ensure we have data
    if (headers.length === 0) return null;

    return {
        headers,
        rows
    };
};

const RenderedCell: React.FC<{ content: string }> = React.memo(({ content }) => {
    // 1. Handle HTML breaks <br> often found in table data
    const lines = content.split(/<br\s*\/?>/i);
    
    return (
        <div className="space-y-1">
            {lines.map((line, idx) => (
                <div key={idx}>{parseInline(line)}</div>
            ))}
        </div>
    );
});

const parseInline = (text: string) => {
    // Regex to split by LaTeX delimiters ($...$ and $$...$$) and Bold (**...**)
    const regex = /(\$\$[\s\S]*?\$\$)|(\$[^$\n]+?\$)|(\*\*[^*]+?\*\*)/g;
    
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
            elements.push(text.substring(lastIndex, match.index));
        }

        const fullMatch = match[0];
        
        if (fullMatch.startsWith('$$')) {
            // Display Math
            const latex = fullMatch.slice(2, -2);
            try {
                const html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
                elements.push(<span key={match.index} dangerouslySetInnerHTML={{ __html: html }} className="block my-1" />);
            } catch (e) {
                elements.push(fullMatch);
            }
        } else if (fullMatch.startsWith('$')) {
            // Inline Math
            const latex = fullMatch.slice(1, -1);
             try {
                const html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
                elements.push(<span key={match.index} dangerouslySetInnerHTML={{ __html: html }} />);
            } catch (e) {
                elements.push(fullMatch);
            }
        } else if (fullMatch.startsWith('**')) {
            // Bold
            elements.push(<strong key={match.index}>{fullMatch.slice(2, -2)}</strong>);
        }

        lastIndex = regex.lastIndex;
    }

    // Remaining text
    if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
    }

    return <>{elements}</>;
};

export const TableRenderer: React.FC<TableRendererProps> = ({ data, className = '' }) => {
    const [copied, setCopied] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!data || !data.headers || !data.rows) {
        return <div className="text-gray-500 italic">No table data available</div>;
    }

    const handleCopy = () => {
        // Convert table to markdown
        const markdown = convertToMarkdown(data);
        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        // Convert table to CSV
        const csv = convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.title || 'table'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 my-4 flex flex-col ${className} ${isExpanded ? 'fixed inset-4 z-50 m-0' : 'relative'}`}>
            {/* Header */}
            {data.title && (
                <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white flex-shrink-0">
                    <h3 className="text-xl font-bold">{data.title}</h3>
                </div>
            )}

            {/* Actions Bar */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between flex-shrink-0">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {data.rows.length} rows × {data.headers.length} columns
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title={isExpanded ? "Collapse" : "Expand to Full Screen"}
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Copy as Markdown"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={handleDownload}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Download as CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className={`overflow-auto flex-grow ${isExpanded ? '' : 'max-h-96'}`}>
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-gray-100 dark:bg-gray-700">
                            {data.headers.map((header, idx) => (
                                <th
                                    key={idx}
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-blue-500 whitespace-nowrap bg-gray-100 dark:bg-gray-700"
                                >
                                    <RenderedCell content={header} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {data.rows.map((row, rowIdx) => (
                            <tr
                                key={rowIdx}
                                className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors bg-white dark:bg-gray-800"
                            >
                                {row.map((cell, cellIdx) => (
                                    <td
                                        key={cellIdx}
                                        className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-normal border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 min-w-[150px]"
                                    >
                                        <RenderedCell content={cell} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Caption */}
            {data.caption && (
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex-shrink-0">
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">{data.caption}</p>
                </div>
            )}
            
            {isExpanded && (
                 <div className="absolute top-4 right-4 z-50">
                    <button 
                        onClick={() => setIsExpanded(false)}
                        className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                        <Minimize2 className="w-6 h-6" />
                    </button>
                 </div>
            )}
        </div>
    );
};

// Helper function to convert table to markdown
const convertToMarkdown = (data: TableData): string => {
    let markdown = '';
    
    if (data.title) {
        markdown += `# ${data.title}\n\n`;
    }
    
    // Headers
    markdown += '| ' + data.headers.join(' | ') + ' |\n';
    
    // Separator
    markdown += '| ' + data.headers.map(() => '---').join(' | ') + ' |\n';
    
    // Rows
    data.rows.forEach(row => {
        markdown += '| ' + row.join(' | ') + ' |\n';
    });
    
    if (data.caption) {
        markdown += `\n*${data.caption}*\n`;
    }
    
    return markdown;
};

// Helper function to convert table to CSV
const convertToCSV = (data: TableData): string => {
    const escapeCSV = (str: string) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    
    let csv = '';
    
    // Headers
    csv += data.headers.map(escapeCSV).join(',') + '\n';
    
    // Rows
    data.rows.forEach(row => {
        csv += row.map(escapeCSV).join(',') + '\n';
    });
    
    return csv;
};

export default TableRenderer;
