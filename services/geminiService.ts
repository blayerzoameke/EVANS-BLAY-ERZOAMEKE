import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import type { ImagePart, UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, QuizQuestion, QuizType, ChatTurn } from './types.ts';

// --- Local Graph Generation (as provided by user) ---

function parseExpressionSafely(expr: string): string {
    if (!expr) return '';
    
    let cleaned = expr.trim()
        .replace(/\s+/g, '') // Remove spaces
        .replace(/\^/g, '**') // Convert ^ to **
        .replace(/π|pi/gi, 'Math.PI') // Convert pi
        .replace(/e(?![a-zA-Z])/g, 'Math.E') // Convert e constant
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\blog\b/g, 'Math.log10') // log = log base 10
        .replace(/\bln\b/g, 'Math.log')   // ln = natural log
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bexp\b/g, 'Math.exp')
        .replace(/\bfloor\b/g, 'Math.floor')
        .replace(/\bceil\b/g, 'Math.ceil');
    
    // Handle implicit multiplication more carefully
    cleaned = cleaned
        .replace(/(\d)([a-zA-Z])/g, '$1*$2')     // 2x -> 2*x
        .replace(/([a-zA-Z])(\d)/g, '$1*$2')     // x2 -> x*2
        .replace(/\)([a-zA-Z]|\()/g, ')*$1')     // )(... -> )*(...)
        .replace(/([a-zA-Z])\(/g, '$1*(');       // x(...) -> x*(...)
    
    return cleaned;
}


function buildAdvancedEvaluator(expr: string): ((x: number) => number) | null {
    if (!expr) return null;
    
    const normalized = parseExpressionSafely(expr);
    
    try {
        const fn = new Function('x', `
            try {
                const Math = globalThis.Math || window.Math;
                if (typeof x !== 'number' || !isFinite(x)) return NaN;
                const result = ${normalized};
                
                if (typeof result !== 'number' || !isFinite(result)) return NaN;
                if (Math.abs(result) > 1000) return NaN;
                
                return result;
            } catch (e) {
                return NaN;
            }
        `);
        
        const testValues = [0, 1, -1, 0.5, 2, -2];
        let validTests = 0;
        for (const testVal of testValues) {
            const result = fn(testVal);
            if (typeof result === 'number' && isFinite(result)) {
                validTests++;
            }
        }
        
        if (validTests < 2) {
            throw new Error('Function produces too few valid results');
        }
        
        return fn as (x: number) => number;
    } catch (error) {
        console.warn('Failed to build evaluator for:', expr, error);
        return null;
    }
}

export function generateChartConfigForFunction({ 
    expr, 
    xMin, 
    xMax, 
    samples = 500, 
    titleOverride 
}: { 
    expr: string; 
    xMin: number; 
    xMax: number; 
    samples?: number; 
    titleOverride?: string | null; 
}) {
    const evaluator = buildAdvancedEvaluator(expr);
    if (!evaluator) throw new Error(`Could not parse expression: ${expr}`);

    const data: { x: number; y: number }[] = [];
    const allYValues: number[] = [];
    
    for (let i = 0; i <= samples; i++) {
        const x = xMin + (xMax - xMin) * (i / samples);
        const y = evaluator(x);
        
        if (isFinite(y) && !isNaN(y) && Math.abs(y) < 1000) {
            const roundedX = Math.round(x * 1e10) / 1e10;
            const roundedY = Math.round(y * 1e10) / 1e10;
            
            data.push({ x: roundedX, y: roundedY });
            allYValues.push(roundedY);
        }
    }

    if (data.length === 0) {
        throw new Error(`No valid data points generated for expression: ${expr}`);
    }

    let yMin, yMax;
    
    if (allYValues.length > 0) {
        const sorted = [...allYValues].sort((a, b) => a - b);
        const trimPercent = Math.min(0.15, 20 / sorted.length);
        const lowerTrimIndex = Math.floor(sorted.length * trimPercent);
        const upperTrimIndex = Math.floor(sorted.length * (1 - trimPercent));
        const trimmedValues = sorted.slice(lowerTrimIndex, upperTrimIndex);
        
        if (trimmedValues.length > 0) {
            yMin = trimmedValues[0];
            yMax = trimmedValues[trimmedValues.length - 1];
        } else {
            yMin = sorted[0];
            yMax = sorted[sorted.length - 1];
        }
        
        const range = yMax - yMin;
        let padding;
        if (range < 1e-6) {
            padding = Math.max(Math.abs(yMin) * 0.1, 1);
        } else {
            padding = Math.min(range * 0.15, 50);
        }
        
        yMin -= padding;
        yMax += padding;
        
        const maxRange = 1000;
        if (yMax - yMin > maxRange) {
            const center = (yMin + yMax) / 2;
            yMin = center - maxRange / 2;
            yMax = center + maxRange / 2;
        }
        
        yMin = Math.max(yMin, -500);
        yMax = Math.min(yMax, 500);
    } else {
        yMin = -10;
        yMax = 10;
    }

    if (!isFinite(yMin) || !isFinite(yMax) || yMin >= yMax) {
        yMin = -10;
        yMax = 10;
    }

    return {
        type: 'line',
        data: {
            datasets: [{
                label: `y = ${expr}`,
                data: data,
                borderColor: '#3e95cd',
                backgroundColor: 'rgba(62, 149, 205, 0.1)',
                fill: false,
                tension: 0,
                pointRadius: 0,
                borderWidth: 2,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                title: { display: true, text: titleOverride || `Graph of y = ${expr}` },
                legend: { display: true }
            },
            scales: {
                x: {
                    type: 'linear', position: 'bottom', title: { display: true, text: 'x' },
                    min: xMin, max: xMax, grid: { color: 'rgba(0,0,0,0.1)' }
                },
                y: {
                    type: 'linear', title: { display: true, text: 'y' },
                    min: yMin, max: yMax, grid: { color: 'rgba(0,0,0,0.1)' }
                }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    };
}


// --- AI Service Setup ---

const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY! });

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

async function callApi(prompt: any, schema?: any, imagePart?: ImagePart) {
    if (!API_KEY) return Promise.reject(new Error("API Key is not configured."));

    const contents = imagePart ? { parts: [{ text: prompt }, imagePart] } : prompt;
    const config = {
        responseMimeType: schema ? "application/json" : "text/plain",
        responseSchema: schema,
        temperature: 0.2,
        topP: 0.8,
        topK: 10,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            // FIX: Corrected API call structure. `safetySettings` must be inside the `config` object.
            config: {
                ...config,
                safetySettings,
            },
        });
        const text = response.text.trim();
        const cleanText = text.replace(/^```json\s*|```\s*$/g, '');
        if (schema) {
            return JSON.parse(cleanText);
        }
        return cleanText;
    } catch (error: any) {
        console.error("Gemini API call failed:", error);
        const message = error.toString();
        if (message.includes('API key not valid')) {
             throw new Error("The provided API key is not valid. Please check your configuration.");
        }
        throw new Error(`AI service failed. Please try again later. Raw error: ${message}`);
    }
}

// --- Schemas for JSON output ---

const planSlotSchema = {
    type: Type.OBJECT,
    properties: {
        activity: { type: Type.STRING },
        startTime: { type: Type.STRING },
        endTime: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['lecture', 'study', 'agenda', 'break', 'free'] },
    },
    required: ['activity', 'startTime', 'endTime', 'type']
};

const dayPlanSchema = {
    type: Type.OBJECT,
    properties: {
        day: { type: Type.STRING, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
        slots: { type: Type.ARRAY, items: planSlotSchema },
    },
    required: ['day', 'slots']
};

const smartPlanSchema = {
    type: Type.ARRAY,
    items: dayPlanSchema
};

const quizQuestionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Only for Multiple Choice questions.' },
        correctAnswer: { type: Type.STRING },
        explanation: { type: Type.STRING },
        topic: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['Multiple Choice', 'Conceptual', 'Theory-based'] },
    },
    required: ['question', 'correctAnswer', 'explanation', 'topic', 'type']
};

const quizSchema = {
    type: Type.OBJECT,
    properties: {
        questions: { type: Type.ARRAY, items: quizQuestionSchema }
    },
    required: ['questions']
};

const graphSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING },
    data: {
      type: Type.OBJECT,
      properties: {
        datasets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              data: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } } },
              borderColor: { type: Type.STRING },
              backgroundColor: { type: Type.STRING },
              fill: { type: Type.BOOLEAN },
            },
          },
        },
      },
    },
    options: {
      type: Type.OBJECT,
      properties: {
        responsive: { type: Type.BOOLEAN },
        plugins: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.OBJECT, properties: { display: { type: Type.BOOLEAN }, text: { type: Type.STRING } } },
            legend: { type: Type.OBJECT, properties: { display: { type: Type.BOOLEAN } } },
          },
        },
        scales: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, min: { type: Type.NUMBER }, max: { type: Type.NUMBER } } },
            y: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, min: { type: Type.NUMBER }, max: { type: Type.NUMBER } } },
          },
        },
      },
    },
  },
};


// --- Exported Service Functions ---

export async function isImageTimetable(image: ImagePart): Promise<boolean> {
    const prompt = "Analyze this image. Is it a picture of a school timetable, schedule, or calendar? Respond with only 'true' or 'false'.";
    const result = await callApi(prompt, undefined, image);
    return result.toLowerCase().includes('true');
}

export async function generatePlanFromImage(userDetails: UserDetails, studyGoals: StudyGoal[], generalGoals: string, image: ImagePart): Promise<SmartPlan> {
    const prompt = `
        Based on the provided user details, study goals, general goals, and the timetable image, generate a smart weekly study plan.
        User Details: ${JSON.stringify(userDetails)}
        Study Goals: ${JSON.stringify(studyGoals)}
        General Goals/Preferences: ${generalGoals}
        The image contains the user's fixed schedule. Analyze it to identify lectures and other fixed commitments.
        Then, intelligently schedule study sessions for the subjects mentioned in study goals, respecting the user's preferences and ensuring a balanced week with adequate breaks.
        
        Your response MUST be a single, raw, valid JSON array of DayPlan objects and nothing else. Adhere strictly to the required JSON schema. Do not include any explanatory text, comments, or markdown formatting before or after the JSON array.
        Ensure all string values within the JSON are properly escaped if they contain special characters.
    `;
    return await callApi(prompt, smartPlanSchema, image);
}

export async function generateSmartPlan(userDetails: UserDetails, lectures: Lecture[], studyGoals: StudyGoal[], agendaItems: AgendaItem[], generalGoals: string): Promise<SmartPlan> {
    const prompt = `
        Generate a smart weekly study plan based on the following information:
        User Details: ${JSON.stringify(userDetails)}
        Lectures: ${JSON.stringify(lectures)}
        Study Goals: ${JSON.stringify(studyGoals)}
        Other Agenda Items: ${JSON.stringify(agendaItems)}
        General Goals/Preferences: ${generalGoals}
        
        Analyze the user's fixed commitments and intelligently schedule study sessions to meet their goals. Create a balanced weekly schedule with adequate breaks.

        Your response MUST be a single, raw, valid JSON array of DayPlan objects and nothing else. Adhere strictly to the required JSON schema. Do not include any explanatory text, comments, or markdown formatting before or after the JSON array.
        Ensure all string values within the JSON are properly escaped if they contain special characters.
    `;
    return await callApi(prompt, smartPlanSchema);
}

export async function isStudyMaterial(file: ImagePart): Promise<boolean> {
    const prompt = "Analyze this document/image. Does it contain educational content like lecture notes, textbook pages, or academic slides? Respond with only 'true' or 'false'.";
    const result = await callApi(prompt, undefined, file);
    return result.toLowerCase().includes('true');
}

export async function getDocumentContext(file: ImagePart): Promise<string> {
    const prompt = "Briefly identify the main subject and topic of this document in 2-5 words. Examples: 'Quantum Mechanics', 'World History', 'Calculus Formulas'.";
    return await callApi(prompt, undefined, file);
}

export async function summarizeDocument(file: ImagePart, context: string): Promise<string> {
    const prompt = `Based on the document about "${context}", provide a concise summary of the key points. Use markdown for formatting (headings, lists, bold).`;
    return await callApi(prompt, undefined, file);
}

export async function explainDocument(file: ImagePart, context: string): Promise<string> {
    const prompt = `Based on the document about "${context}", explain the main concepts in a simple and easy-to-understand way. Use analogies and examples. Use markdown for formatting.`;
    return await callApi(prompt, undefined, file);
}

export async function extractTextFromDocument(file: ImagePart): Promise<string> {
    const prompt = "Extract all text from this document. Preserve the original formatting as much as possible.";
    return await callApi(prompt, undefined, file);
}

export async function chatWithDocumentStream(file: ImagePart, question: string, history: ChatTurn[], context: string) {
    const historyText = history.map(turn => `User: ${turn.user}\nBlay: ${turn.blay}`).join('\n\n');
    const prompt = `You are a helpful study assistant. The user has uploaded a document about "${context}".
    Here is the conversation history so far:
    ${historyText}

    The user's new question is: "${question}"

    Using the content of the provided document, answer the user's question. If the document doesn't contain the answer, say so. Keep your answer concise and helpful.`;
    
    try {
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, file] },
            config: { temperature: 0.5, topP: 0.9, topK: 20, safetySettings },
        });
        return response;
    } catch (error: any) {
        console.error("Gemini API stream call failed:", error);
        throw new Error(`AI service failed.`);
    }
}

export async function generateQuiz(content: string, numQuestions: number, quizType: QuizType, focusArea: string): Promise<QuizQuestion[]> {
    const prompt = `
      Analyze the following text content and generate a quiz with exactly ${numQuestions} questions of type "${quizType}".
      ${focusArea ? `Focus specifically on this area: "${focusArea}".` : ''}

      Your response MUST be a single, raw, valid JSON object and nothing else. Do not include any explanatory text, markdown formatting like \`\`\`json, or any characters before or after the JSON object.

      The JSON object must have a single root key "questions", which is an array of question objects. Each question object must conform to this structure:
      - "question": string
      - "options": string[] (only for Multiple Choice)
      - "correctAnswer": string
      - "explanation": string
      - "topic": string
      - "type": string (must be "${quizType}")

      CRITICAL INSTRUCTION: All string values within the JSON must be properly escaped.
      - Newlines must be represented as "\\n".
      - Double quotes within a string must be escaped with a backslash, like so: "This is a \\"quote\\". ".
      - Backslashes themselves must be escaped: "C:\\\\path".

      This is extremely important to prevent parsing errors.

      Text Content to Analyze:
      ---
      ${content.substring(0, 20000)}
      ---
    `;
    const result = await callApi(prompt, quizSchema);
    return result.questions;
}

export async function isImageAProblem(image: ImagePart): Promise<boolean> {
    const prompt = "Does this image contain a solvable academic problem (math, physics, chemistry, etc.)? Exclude charts, graphs, or pure text. Respond with only 'true' or 'false'.";
    const result = await callApi(prompt, undefined, image);
    return result.toLowerCase().includes('true');
}

export async function solveProblem(
    questionText: string,
    questionImage: ImagePart | null,
    outputFormat: 'steps' | 'latex' | 'code' | 'graph',
    programmingLanguage: string,
    graphInterval: string
): Promise<string> {
    if (outputFormat === 'graph') {
        const match = questionText.match(/(?:plot|graph|draw)\s+(?:y\s*=\s*)?(.+)/i);
        const expr = match ? match[1].trim() : questionText.trim();
        
        let xMin = -10, xMax = 10;
        const intervalMatch = graphInterval.match(/(-?\d+(?:\.\d+)?)\s*to\s*(-?\d+(?:\.\d+)?)/i);
        if (intervalMatch) {
            xMin = parseFloat(intervalMatch[1]);
            xMax = parseFloat(intervalMatch[2]);
        }
        
        try {
            const chartConfig = generateChartConfigForFunction({ expr, xMin, xMax });
            return JSON.stringify(chartConfig);
        } catch (localError) {
            console.warn("Local graph generation failed, falling back to API:", localError);
            const prompt = `Generate a JSON object for Chart.js to plot the function: y = ${expr}. ${graphInterval ? `Use the interval ${graphInterval} for the x-axis.` : 'Choose a sensible default interval that shows the key features of the graph.'} The JSON must be a valid Chart.js configuration. Ensure the y-axis is scaled appropriately to prevent distortion, especially for functions that go to infinity. For functions with discontinuities like tan(x), create separate datasets for each continuous segment. Your response MUST be ONLY the raw JSON object, without any markdown formatting, comments, or other text.`;
            return await callApi(prompt, graphSchema);
        }
    }

    let prompt = '';
    if (outputFormat === 'steps') {
        prompt = `Solve the following problem step-by-step. Explain each step clearly. Use markdown for formatting, including LaTeX for equations (e.g., $ax^2+bx+c=0$). Problem: ${questionText}`;
    } else if (outputFormat === 'latex') {
        prompt = `Provide the full LaTeX solution for this problem: ${questionText}. Output only the LaTeX code, enclosed in $$...$$.`;
    } else if (outputFormat === 'code') {
        prompt = `Write a ${programmingLanguage} function or script to solve this problem: ${questionText}. Include comments to explain the code. Output only the code block with language identifier.`;
    }

    return await callApi(prompt, undefined, questionImage || undefined);
}