import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, ImagePart, QuizQuestion, ChatTurn } from '../types.ts';
import { QuizType } from '../types.ts';

// @ts-ignore
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const graphSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, enum: ['line', 'bar', 'pie', 'doughnut', 'radar', 'polarArea', 'bubble', 'scatter'] },
        data: {
            type: Type.OBJECT,
            properties: {
                labels: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    nullable: true,
                },
                datasets: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING },
                            data: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        x: { type: Type.NUMBER, nullable: true },
                                        y: { type: Type.NUMBER, nullable: true },
                                    },
                                    nullable: true,
                                },
                            },
                            backgroundColor: { type: Type.STRING, nullable: true },
                            borderColor: { type: Type.STRING, nullable: true },
                            fill: { type: Type.BOOLEAN, nullable: true },
                        },
                        required: ['label', 'data'],
                    },
                },
            },
            required: ['datasets'],
        },
        options: {
            type: Type.OBJECT,
            properties: {
                plugins: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.OBJECT,
                            properties: {
                                display: { type: Type.BOOLEAN, nullable: true },
                                text: { type: Type.STRING, nullable: true },
                            },
                        },
                    },
                },
                scales: {
                    type: Type.OBJECT,
                    properties: {
                        x: {
                            type: Type.OBJECT,
                            properties: {
                                title: {
                                    type: Type.OBJECT,
                                    properties: {
                                        display: { type: Type.BOOLEAN, nullable: true },
                                        text: { type: Type.STRING, nullable: true },
                                    }
                                },
                                min: { type: Type.NUMBER, nullable: true },
                                max: { type: Type.NUMBER, nullable: true },
                            },
                        },
                        y: {
                            type: Type.OBJECT,
                            properties: {
                                title: {
                                    type: Type.OBJECT,
                                    properties: {
                                        display: { type: Type.BOOLEAN, nullable: true },
                                        text: { type: Type.STRING, nullable: true },
                                    }
                                },
                                min: { type: Type.NUMBER, nullable: true },
                                max: { type: Type.NUMBER, nullable: true },
                            },
                        }
                    },
                }
            },
            nullable: true,
        },
    },
    required: ['type', 'data'],
};

// --- Plan Generation Functions ---

export const isImageTimetable = async (imagePart: ImagePart): Promise<boolean> => {
    const prompt = 'Analyze the following image. Does it contain a timetable, schedule, or calendar? Respond with only "true" or "false".';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, imagePart] },
        });
        const textResponse = response.text.trim().toLowerCase();
        return textResponse === 'true';
    } catch (error) {
        console.error("Error verifying timetable image:", error);
        return false;
    }
};

export const generatePlanFromImage = async (
    userDetails: UserDetails,
    studyGoals: StudyGoal[],
    generalGoals: string,
    imagePart: ImagePart
): Promise<SmartPlan> => {
    const prompt = `
You are an expert academic planner. Your task is to analyze the provided user details, study goals, general preferences, and an image of a timetable. Based on all this information, create a structured, smart, and balanced weekly study plan in JSON format.

**User Details:**
- Name: ${userDetails.name}
- Educational Level: ${userDetails.educationalLevel}
- Institution: ${userDetails.institution || 'Not provided'}
- Programme of Study: ${userDetails.programmeOfStudy || 'Not provided'}

**Study Goals:**
${studyGoals.map(g => `- Study ${g.subject} for ${g.hours} hours per week.`).join('\n') || 'No specific study goals provided.'}

**General Goals & Preferences:**
${generalGoals || 'No general preferences provided.'}

**Timetable Image:**
The user has provided an image of their existing timetable. Extract all fixed activities like lectures from this image.

**Instructions:**
1.  **Extract Fixed Activities:** Analyze the timetable image to identify all fixed lectures and their timings.
2.  **Integrate Study Goals:** Schedule study sessions for the subjects listed in the study goals, respecting the required hours per week.
3.  **Incorporate Preferences:** Take the user's general goals and preferences into account (e.g., study times, break lengths).
4.  **Add Breaks:** Schedule short breaks (10-15 mins) and longer breaks (e.g., lunch). Ensure the schedule is not overwhelming.
5.  **Output JSON:** Your entire response MUST be a single JSON object representing the weekly plan. The JSON should be an array of DayPlan objects.
    - Each DayPlan object has a 'day' (e.g., "Monday") and a 'slots' array.
    - Each slot in the 'slots' array must have 'activity' (string), 'startTime' (string, "HH:MM AM/PM"), 'endTime' (string, "HH:MM AM/PM"), and 'type' (string: "lecture", "study", "agenda", "break", "free").
    - Ensure all time slots for a given day are contiguous and cover the main parts of the day.

**JSON Schema:**
\`\`\`json
[
  {
    "day": "Monday",
    "slots": [
      { "activity": "Calculus II", "startTime": "09:00 AM", "endTime": "10:00 AM", "type": "lecture" },
      { "activity": "Study: Physics", "startTime": "10:00 AM", "endTime": "12:00 PM", "type": "study" }
    ]
  },
  ...
]
\`\`\`
`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, imagePart] },
        });
        const jsonString = response.text.replace(/```json\n|```/g, '').trim();
        return JSON.parse(jsonString) as SmartPlan;
    } catch (error) {
        console.error("Error generating plan from image:", error);
        throw new Error("Failed to generate a plan from the timetable image. The image might be unclear or the structure too complex.");
    }
};

export const generateSmartPlan = async (
    userDetails: UserDetails,
    lectures: Lecture[],
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string
): Promise<SmartPlan> => {
    const prompt = `
You are an expert academic planner. Your task is to create a structured, smart, and balanced weekly study plan in JSON format based on the provided user details and schedule information.

**User Details:**
- Name: ${userDetails.name}
- Educational Level: ${userDetails.educationalLevel}
- Institution: ${userDetails.institution || 'Not provided'}
- Programme of Study: ${userDetails.programmeOfStudy || 'Not provided'}

**Fixed Lectures:**
${lectures.map(l => `- ${l.subject} on ${l.day} from ${l.startTime} to ${l.endTime}.`).join('\n') || 'No lectures provided.'}

**Fixed Agenda Items:**
${agendaItems.map(a => `- ${a.title} on ${a.day} from ${a.startTime} to ${a.endTime}.`).join('\n') || 'No other fixed activities provided.'}

**Study Goals:**
${studyGoals.map(g => `- Study ${g.subject} for ${g.hours} hours per week.`).join('\n') || 'No specific study goals provided.'}

**General Goals & Preferences:**
${generalGoals || 'No general preferences provided.'}

**Instructions:**
1.  **Schedule Fixed Activities:** Place all lectures and agenda items into the schedule first.
2.  **Integrate Study Goals:** Schedule study sessions for the subjects listed in the study goals, respecting the required hours per week. Distribute these sessions logically throughout the week.
3.  **Incorporate Preferences:** Take the user's general goals and preferences into account (e.g., preferred study times, break lengths).
4.  **Add Breaks:** Intelligently schedule short breaks (10-15 mins) and longer breaks (e.g., lunch). Ensure the schedule is not overwhelming and promotes well-being. Fill any remaining large gaps with "Free Time".
5.  **Output JSON:** Your entire response MUST be a single JSON object representing the weekly plan. The JSON should be an array of DayPlan objects.
    - Each DayPlan object has a 'day' (e.g., "Monday") and a 'slots' array.
    - Each slot in the 'slots' array must have 'activity' (string), 'startTime' (string, "HH:MM AM/PM"), 'endTime' (string, "HH:MM AM/PM"), and 'type' (string: "lecture", "study", "agenda", "break", "free").
    - Ensure all time slots for a given day are contiguous and cover the main parts of the day (e.g., from 8 AM to 10 PM).

**JSON Schema:**
\`\`\`json
[
  {
    "day": "Monday",
    "slots": [
      { "activity": "Calculus II", "startTime": "09:00 AM", "endTime": "10:00 AM", "type": "lecture" },
      { "activity": "Study: Physics", "startTime": "10:00 AM", "endTime": "12:00 PM", "type": "study" }
    ]
  },
  ...
]
\`\`\`
`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });
        const jsonString = response.text.replace(/```json\n|```/g, '').trim();
        return JSON.parse(jsonString) as SmartPlan;
    } catch (error) {
        console.error("Error generating smart plan:", error);
        throw new Error("Failed to generate a smart plan. The inputs might be conflicting or too complex.");
    }
};

// --- Learning Hub & Exam Prep Functions ---

export const isStudyMaterial = async (filePart: ImagePart): Promise<boolean> => {
    const prompt = 'Analyze the following image or document page. Does it contain academic or study-related material (e.g., lecture slides, textbook pages, notes, diagrams)? Respond with only "true" or "false".';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, filePart] },
        });
        return response.text.trim().toLowerCase() === 'true';
    } catch (error) {
        console.error("Error verifying study material:", error);
        return false;
    }
};

export const getDocumentContext = async (filePart: ImagePart): Promise<string> => {
    const prompt = 'Analyze the provided document page. What is the primary subject or topic? For example: "Quantum Mechanics", "History of Rome", "Calculus II". Respond with only the subject name.';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, filePart] },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error getting document context:", error);
        return 'General';
    }
};

export const extractTextFromDocument = async (filePart: ImagePart): Promise<string> => {
    const prompt = 'Extract all text from the provided image or document page. Preserve formatting like paragraphs and headings where possible.';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, filePart] },
        });
        return response.text;
    } catch (error) {
        console.error("Error extracting text from document:", error);
        throw new Error("Failed to extract text from the document.");
    }
};

export const summarizeDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = `You are a helpful academic assistant. The user has uploaded a document about "${context}". Please provide a concise summary of the key points from the provided page. Use Markdown for formatting.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, filePart] },
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing document:", error);
        throw new Error("Failed to generate a summary for the document.");
    }
};

export const explainDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = `You are an expert teacher. The user has uploaded a document about "${context}". Explain the main concepts from this document page in a clear and simple way. Use analogies and examples where helpful. Use Markdown for formatting and LaTeX for equations.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, filePart] },
        });
        return response.text;
    } catch (error) {
        console.error("Error explaining document:", error);
        throw new Error("Failed to generate an explanation for the document.");
    }
};

export const chatWithDocumentStream = async (
    filePart: ImagePart,
    userMessage: string,
    chatHistory: ChatTurn[],
    context: string
): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const historyFormatted = chatHistory.map(turn => `User: ${turn.user}\nBlay: ${turn.blay}`).join('\n\n');
    const prompt = `You are Blay, a helpful AI study assistant. You are chatting with a user about a document they uploaded. The document's main topic is "${context}". The user's new message is: "${userMessage}". Please provide a helpful and conversational response based on the document content and the chat history.`;
    try {
        return await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, filePart] },
        });
    } catch (error) {
        console.error("Error chatting with document:", error);
        throw new Error("Failed to get a response from the document chat.");
    }
};

export const isImageAProblem = async (imagePart: ImagePart): Promise<boolean> => {
    const prompt = `Analyze the following image. Does it contain an academic problem, question, or equation that can be solved (e.g., math, physics, chemistry, programming)? Respond with only "true" or "false".`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, imagePart] },
        });
        return response.text.trim().toLowerCase() === 'true';
    } catch (error) {
        console.error("Error verifying problem image:", error);
        return false;
    }
};

export const generateQuiz = async (
    content: string,
    numQuestions: number,
    quizType: QuizType,
    focusArea: string
): Promise<QuizQuestion[]> => {
    const prompt = `You are an expert quiz creator for students. Based on the following study material, create a quiz with ${numQuestions} questions of the type "${quizType}".

**Focus Area (if provided):** ${focusArea || 'The entire document.'}

**Study Material Content (first 30k chars):**
---
${content.substring(0, 30000)}
---

Your entire response MUST be a single JSON object containing a "questions" array, conforming to the provided schema. Do not include any other text, comments, or markdown.`;

    const questionSchema: any = {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: 'Only for Multiple Choice questions.' },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            topic: { type: Type.STRING },
            type: { type: Type.STRING, enum: [quizType] },
        },
        required: ['question', 'correctAnswer', 'explanation', 'topic', 'type']
    };

    if (quizType === QuizType.MCQ) {
        questionSchema.properties.options.nullable = false;
        questionSchema.required.push('options');
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { questions: { type: Type.ARRAY, items: questionSchema } }, required: ['questions'] },
            }
        });
        return (JSON.parse(response.text.trim())).questions as QuizQuestion[];
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate the quiz. The study material might be too short or complex.");
    }
};

// --- Helper functions for local graph generation ---
function parseIntervalString(interval: string | undefined): { xMin: number; xMax: number } | null {
  if (!interval) return null;
  let s = interval.replace(/–|—/g, ' to ').replace(/\s+/g, ' ').trim().toLowerCase();
  const mFrom = s.match(/from\s+(.+?)\s+to\s+(.+)/i);
  const mTo = !mFrom ? s.match(/^(.+?)\s+to\s+(.+)$/i) : null;
  const parts = mFrom ? [mFrom[1], mFrom[2]] : (mTo ? [mTo[1], mTo[2]] : null);
  if (!parts) return null;

  const a = parseNumberWithPi(parts[0]);
  const b = parseNumberWithPi(parts[1]);
  if (!isFinite(a) || !isFinite(b)) return null;
  return { xMin: Math.min(a, b), xMax: Math.max(a, b) };
}

function parseNumberWithPi(tok: string): number {
  if (!tok) return NaN;
  tok = tok.trim().replace(/\s+/g, '').replace('π', 'pi').replace('PI', 'pi');
  const re = /^([+-]?\d*\.?\d*)?pi(?:\/([+-]?\d*\.?\d*))?$/i;
  const m = tok.match(re);
  if (m) {
    let coeffStr = m[1];
    let denomStr = m[2];
    let coeff = (!coeffStr || coeffStr === '+') ? 1 : (coeffStr === '-') ? -1 : parseFloat(coeffStr);
    const denom = denomStr ? parseFloat(denomStr) : 1;
    if (!isFinite(coeff) || !isFinite(denom) || denom === 0) return NaN;
    return (coeff * Math.PI) / denom;
  }
  try {
    const safe = tok.replace(/pi/gi, `(${Math.PI})`);
    if (!/^[0-9\.\+\-\*\/\(\)\s\(\)eE]*$/.test(safe)) return Number(tok);
    // eslint-disable-next-line no-new-func
    const val = new Function(`return (${safe});`)();
    return typeof val === 'number' && isFinite(val) ? val : NaN;
  } catch {
    return Number(tok);
  }
}

function extractExpressionFromText(text: string): string | null {
  if (!text) return null;
  let m = text.match(/y\s*=\s*([^\n,;]+)/i) || text.match(/f\s*\(\s*x\s*\)\s*=\s*([^\n,;]+)/i) || text.match(/plot\s+(.+?)(?:\s+from|\s*$)/i);
  if (m) return m[1].trim();
  const fnMatch = text.match(/([a-zA-Z0-9\^\-\+\*\/\(\)\s]*?(?:sin|cos|tan|exp|log|sqrt)[^(0-9a-zA-Z]*\([^)]*\))/i);
  return fnMatch ? fnMatch[1].trim() : null;
}

function buildEvaluator(expr: string): ((x: number) => number) | null {
  if (!expr) return null;
  const normalized = expr.replace(/\^/g, '**');
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', `with (Math) { return ${normalized}; }`);
    fn(0); // Quick test
    return (x: number) => {
      try {
        const r = fn(x);
        return typeof r === 'number' && isFinite(r) ? r : NaN;
      } catch { return NaN; }
    };
  } catch { return null; }
}

function generateChartConfigForFunction({ expr, xMin, xMax, samples = 400, titleOverride, lineColor = '#3e95cd' }: { expr: string; xMin: number; xMax: number; samples?: number; titleOverride?: string | null; lineColor?: string; }) {
  const evaluator = buildEvaluator(expr);
  if (!evaluator) throw new Error('Could not build evaluator for expression: ' + expr);

  const points: { x: number; y: number | null }[] = [];
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + (xMax - xMin) * (i / samples);
    let y: number | null = evaluator(x);
    if (!isFinite(y) || (y && Math.abs(y) > 1e8)) y = null;
    else { if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
    points.push({ x, y });
  }

  const padding = (yMax - yMin) === 0 ? 1 : Math.abs(yMax - yMin) * 0.12;
  return {
    type: 'line',
    data: { datasets: [{ label: expr, data: points, borderColor: lineColor, backgroundColor: lineColor, fill: false, pointRadius: 0, borderWidth: 2, tension: 0.1 }] },
    options: { responsive: true, plugins: { title: { display: true, text: titleOverride || `Plot of ${expr}` } }, scales: { x: { type: 'linear', title: { display: true, text: 'x' } }, y: { title: { display: true, text: 'y' }, suggestedMin: yMin - padding, suggestedMax: yMax + padding } } }
  };
}

function round(v: number, d = 4) { return Math.round(v * (10 ** d)) / (10 ** d); }

// --- Problem Solving Function ---

export const solveProblem = async (questionText: string, imagePart: ImagePart | null, outputFormat: string, language?: string, graphInterval?: string): Promise<string> => {
    let prompt: string;
    const modelConfig: any = { model: 'gemini-2.5-flash' };

    if (outputFormat === 'graph') {
        const exprCandidate = extractExpressionFromText(questionText);
        let interval = parseIntervalString(graphInterval);
        if (!interval) {
            const eLow = exprCandidate?.toLowerCase() || '';
            if (/\bsin\b|\bcos\b/.test(eLow)) interval = { xMin: -2 * Math.PI, xMax: 2 * Math.PI };
            else if (/\btan\b/.test(eLow)) interval = { xMin: -Math.PI / 2 + 0.01, xMax: Math.PI / 2 - 0.01 };
            else interval = { xMin: -10, xMax: 10 };
        }
        if (exprCandidate) {
            try {
                const cfg = generateChartConfigForFunction({ expr: exprCandidate, xMin: interval.xMin, xMax: interval.xMax, titleOverride: `y = ${exprCandidate}` });
                return JSON.stringify(cfg);
            } catch (err) { console.warn('Local chart generation failed, falling back to AI.', err); }
        }

        prompt = `You are an expert academic problem solver. Your task is to provide a single, valid Chart.js JSON configuration object to visually represent the solution to the following problem.
Problem:
---
${questionText}
---
**CRITICAL INSTRUCTIONS for Function Plots (e.g., y = 2^x, sin(x)):**
- The chart type must be 'line'.
- The data for each dataset MUST be an array of objects with numerical 'x' and 'y' properties. Example: "data": [{"x": 0, "y": 1}, {"x": 1, "y": 2}].
- Generate at least 200 data points evenly spaced across the chosen interval to create a smooth and accurate curve.
- DO NOT use the labels property in the data object for function plots. Use numerical x values inside the dataset's data array instead.
- For styling, in each dataset object, set borderColor to a distinct, vibrant color (e.g., '#3e95cd') and set fill: false.
- CRITICAL: Based on the generated data points, determine and explicitly set appropriate 'min' and 'max' values for both the x and y axes in the 'scales' options to ensure the graph is well-proportioned and all key features are visible.
`;
        prompt += graphInterval ? `- The graph must be plotted over the specified interval: ${graphInterval}.\n` : `- Since no interval was provided, choose a sensible default interval that clearly shows the function's behavior (for sine/cos use -2π..2π, otherwise -10..10).\n`;
        prompt += `- Include the function and chosen interval in the chart's title and include axis titles for both X and Y.`;

        modelConfig.config = { responseMimeType: "application/json", responseSchema: graphSchema };
    } else {
        prompt = `You are an expert academic problem solver. Your task is to provide a clear, step-by-step solution to the following problem.
Problem:
---
${questionText}
---
Instructions:
- Analyze the problem carefully. If an image is provided, it is part of the problem statement.
- Provide the solution in the format: "${outputFormat}".\n`;
        if (outputFormat === 'code' && language) {
            prompt += `- The programming language for the code solution must be: ${language}.\n`;
        }
        prompt += `- Format your response using Markdown. Use LaTeX for mathematical equations (inline with $...$ and display with $$...$$). For code, use triple backticks with the language specified (e.g., \`\`\`python).`;
    }

    const contents: any = { parts: [{ text: prompt }] };
    if (imagePart) contents.parts.push(imagePart);
    modelConfig.contents = contents;

    try {
        const response = await ai.models.generateContent(modelConfig);
        return response.text;
    } catch (error) {
        console.error("Error solving problem:", error);
        throw new Error("Failed to solve the problem. The question might be too complex or not suitable for the selected format.");
    }
};