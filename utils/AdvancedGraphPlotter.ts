
// Advanced Graph Plotting System for All Function Types
// Supports trigonometric, polynomial, exponential, logarithmic, rational functions
// Handles both radians and degrees
// Configurable sample points and intervals

export interface GraphConfig {
    expr: string;
    xMin: number;
    xMax: number;
    samples?: number;
    angleMode?: 'radians' | 'degrees';
}

export interface ChartPoint {
    x: number;
    y: number | null;
}

export class AdvancedGraphPlotter {
    private angleMode: 'radians' | 'degrees' = 'radians';

    // Parse user interval string with support for radians/degrees and sample points
    public parseInterval(intervalStr: string): { xMin?: number; xMax?: number; angleMode: 'radians' | 'degrees', samples?: number } | null {
        if (!intervalStr) return null;

        const lowerStr = intervalStr.toLowerCase();
        let angleMode: 'radians' | 'degrees' = 'radians';
        
        if (lowerStr.includes('deg') || lowerStr.includes('degree')) {
            angleMode = 'degrees';
        } else if (lowerStr.includes('rad')) {
            angleMode = 'radians';
        }

        let cleaned = lowerStr
            .replace(/degrees?|deg|radians?|rad/g, '')
            .replace(/to|from/gi, ' ')
            .replace(/[,\[\]]/g, ' ')
            .trim();
        
        const pointsMatch = cleaned.match(/(\d+)\s*points?/);
        let samples: number | undefined = undefined;
        if (pointsMatch) {
            samples = parseInt(pointsMatch[1], 10);
            cleaned = cleaned.replace(/(\d+)\s*points?/, '').trim();
        }

        const piPattern = /(-?\d*\.?\d*)\s*\*?\s*pi/g;
        cleaned = cleaned.replace(piPattern, (match, coeff) => {
            const coefficient = coeff === '' || coeff === '-' ? (coeff === '-' ? -1 : 1) : parseFloat(coeff);
            return String(coefficient * Math.PI);
        });

        const numbers = cleaned.match(/-?\d+\.?\d*/g);
        
        const result: { xMin?: number, xMax?: number, angleMode: 'radians' | 'degrees', samples?: number } = { angleMode };
        let hasContent = false;

        if (numbers && numbers.length >= 2) {
            const min = parseFloat(numbers[0]);
            const max = parseFloat(numbers[1]);
            if (!isNaN(min) && !isNaN(max) && min < max) {
                result.xMin = min;
                result.xMax = max;
                hasContent = true;
            }
        }

        if (samples !== undefined) {
            result.samples = samples;
            hasContent = true;
        }

        return hasContent ? result : null;
    }

    private parseExpression(expr: string): string {
        if (!expr) return '';

        let cleaned = expr.trim()
            .replace(/\s+/g, '')
            .replace(/\^/g, '**')
            .replace(/π|pi/gi, 'PI')
            .replace(/\b(e)\b/g, 'E');

        // Add parentheses to disambiguate operator precedence.
        // Handles negative exponents, e.g., x**-2 -> x**(-2)
        cleaned = cleaned.replace(/\*\*-/g, '**(-');
        // Handles unary minus with exponentiation, e.g., -x**2 -> -(x**2)
        cleaned = cleaned.replace(/-((\w|\([^)]+\))\*\*)/g, '-($1');
        // Add closing parentheses for the unary minus and negative exponent fixes
        let openParenCount = (cleaned.match(/\(/g) || []).length;
        let closeParenCount = (cleaned.match(/\)/g) || []).length;
        while(openParenCount > closeParenCount) {
            cleaned += ')';
            closeParenCount++;
        }
        
        // Implicit multiplication:
        // number before letter or opening paren: 2x -> 2*x, 3(x+1) -> 3*(x+1)
        cleaned = cleaned.replace(/(\d(?:\.\d+)?)(\b[a-zA-Z](?![a-zA-Z\d]))/g, '$1*$2');
        cleaned = cleaned.replace(/(\d(?:\.\d+)?)\(/g, '$1*(');
        // letter or closing paren before number: x2 -> x*2, (x+1)3 -> (x+1)*3
        cleaned = cleaned.replace(/([a-zA-Z)])(\d(?:\.\d+)?)/g, '$1*$2');
        // closing paren before letter or opening paren: (x)(y) -> (x)*(y)
        cleaned = cleaned.replace(/\)([a-zA-Z(])/g, ')*$1');

        return cleaned;
    }

    private buildEvaluator(expr: string): ((x: number) => number | null) | null {
        const normalized = this.parseExpression(expr);
        try {
            const evaluator = new Function('x', `
                const { PI, E, sin, cos, tan, asin, acos, atan, log10, log, sqrt, abs, exp, floor, ceil, round } = Math;
                
                const sinDeg = (deg) => sin(deg * PI / 180);
                const cosDeg = (deg) => cos(deg * PI / 180);
                const tanDeg = (deg) => tan(deg * PI / 180);
                const asinDeg = (val) => asin(val) * 180 / PI;
                const acosDeg = (val) => acos(val) * 180 / PI;
                const atanDeg = (val) => atan(val) * 180 / PI;

                try {
                    const result = ${this.angleMode === 'degrees' 
                        ? normalized
                            .replace(/\basin\b/g, 'asinDeg')
                            .replace(/\bacos\b/g, 'acosDeg')
                            .replace(/\batan\b/g, 'atanDeg')
                            .replace(/\bsin\b/g, 'sinDeg')
                            .replace(/\bcos\b/g, 'cosDeg')
                            .replace(/\btan\b/g, 'tanDeg')
                        : normalized
                    };
                    if (typeof result !== 'number' || !isFinite(result)) {
                        return null;
                    }
                    return result;
                } catch (e) {
                    return null;
                }
            `);
            return evaluator as (x: number) => number | null;
        } catch (error) {
            console.error('Failed to build evaluator for expression:', expr, error);
            return null;
        }
    }

    public determineSmartInterval(expr: string): { xMin: number; xMax: number } {
        const lower = expr.toLowerCase();

        if (/\b(sin|cos|csc|sec)\b/.test(lower)) return { xMin: -2 * Math.PI, xMax: 2 * Math.PI };
        if (/\btan\b/.test(lower)) return { xMin: -Math.PI * 1.5, xMax: Math.PI * 1.5 };
        if (/\bcot\b/.test(lower)) return { xMin: 0.1, xMax: Math.PI * 2 };
        if (/\b(asin|acos)\b/.test(lower)) return { xMin: -1, xMax: 1 };
        if (/\batan\b/.test(lower)) return { xMin: -5, xMax: 5 };
        if (/\b(exp|e\^|\d\^x)\b/.test(lower)) return { xMin: -3, xMax: 3 };
        if (/\b(log|ln)\b/.test(lower)) return { xMin: 0.01, xMax: 10 };
        if (/\bsqrt\b/.test(lower)) return { xMin: 0, xMax: 25 };
        if (/1\s*\/\s*x|x\^-1/.test(lower)) return { xMin: -10, xMax: 10 };

        if (/x\^[2-9]|x\*\*[2-9]/.test(lower)) {
            const degreeMatch = lower.match(/x\^(\d)|x\*\*(\d)/);
            const degree = degreeMatch ? parseInt(degreeMatch[1] || degreeMatch[2] || '2') : 2;
            const range = Math.min(10, Math.pow(10, 1 / degree) * 2);
            return { xMin: -range, xMax: range };
        }

        return { xMin: -10, xMax: 10 };
    }

    public generatePoints(config: GraphConfig): ChartPoint[] {
        this.angleMode = config.angleMode || 'radians';
        const evaluator = this.buildEvaluator(config.expr);
        if (!evaluator) return [];

        const { xMin, xMax } = config;
        const samples = config.samples || 200;

        const points: ChartPoint[] = [];
        const step = (xMax - xMin) / (samples - 1);

        for (let i = 0; i < samples; i++) {
            const x = xMin + i * step;
            const y = evaluator(x);
            points.push({ x, y });
        }
        return points;
    }
}
