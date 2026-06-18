import React, { useState } from 'react';
import { Download, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';

interface TableData {
    title?: string;
    headers: string[];
    rows: string[][];
    caption?: string;
}

interface TableRendererProps {
    data: TableData;
    className?: string;
}

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
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}>
            {/* Header */}
            {data.title && (
                <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    <h3 className="text-xl font-bold">{data.title}</h3>
                </div>
            )}

            {/* Actions Bar */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {data.rows.length} rows × {data.headers.length} columns
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
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

            {/* Table */}
            <div className={`overflow-x-auto ${isExpanded ? 'max-h-none' : 'max-h-96'}`}>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                            {data.headers.map((header, idx) => (
                                <th
                                    key={idx}
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-blue-500"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {data.rows.map((row, rowIdx) => (
                            <tr
                                key={rowIdx}
                                className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                {row.map((cell, cellIdx) => (
                                    <td
                                        key={cellIdx}
                                        className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-normal"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Caption */}
            {data.caption && (
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">{data.caption}</p>
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