import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse, Type } from "@google/genai";
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, ImagePart, QuizQuestion, PlanSlot, ChatTurn } from '../types';
import { QuizType, ActivityType } from '../types';

// ============================================
// CORE CONFIGURATION
// ============================================

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ── CORRECT MODEL STRINGS (verified May 2026) ─────────────────────────────
//
// YOUR OLD CODE:
//   FLASH_MODEL = 'gemini-3-flash-preview'    ← existed but was being proxied wrong
//   PRO_MODEL   = 'gemini-3.1-pro-preview'    ← NO FREE TIER → always 429 RESOURCE_EXHAUSTED
//
// FIX:
//   FLASH_MODEL = 'gemini-3-flash-preview'    ← correct, has free tier
//   PRO_MODEL   = 'gemini-3-flash-preview'    ← use Flash for deep analysis (Pro has no free tier)
//   LITE_MODEL  = 'gemini-3-flash-preview'        ← fastest + cheapest for simple checks
//
// Source: https://ai.google.dev/gemini-api/docs/gemini-3
// "gemini-3-flash-preview and gemini-3.1-flash-lite have free tiers in the Gemini API.
//  There is no free tier available for gemini-3.1-pro-preview in the Gemini API."

const FLASH_MODEL = 'gemini-3-flash-preview';       // Main model — fast, multimodal, free tier
const PRO_MODEL   = 'gemini-3-flash-preview';       // Same as flash — Pro has NO free tier, causes 429
const LITE_MODEL  = 'gemini-3-flash-preview';        // Ultra-fast for simple true/false checks

// ── RETRY WRAPPER — handles 429 RESOURCE_EXHAUSTED ────────────────────────
// Retries up to 3 times with exponential backoff: 1s → 2s → 4s
// Also catches wrong model name errors and gives a clear message.
const withRetry = async <T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> => {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastError = err;
            const msg = (err?.message || '').toLowerCase();
            const isQuota    = msg.includes('429') || msg.includes('resource_exhausted');
            const isNotFound = msg.includes('not found') || msg.includes('proxying failed') || msg.includes('404');

            if (isNotFound) {
                throw new Error(`AI model not found. Check model name. Detail: ${err.message}`);
            }
            if (isQuota && attempt < maxAttempts) {
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
                continue;
            }
            if (!isQuota) break;
        }
    }
    throw lastError;
};

// ============================================
// SCHEMAS
// ============================================

const planSlotSchema = {
    type: Type.OBJECT,
    properties: {
        activity: { type: Type.STRING, description: "The name of the class, subject, or task." },
        startTime: { type: Type.STRING, description: "Format: HH:MM AM/PM" },
        endTime: { type: Type.STRING, description: "Format: HH:MM AM/PM" },
        type: { type: Type.STRING, description: "MUST be one of: 'lecture', 'study', 'agenda', 'break', 'free'." },
        code: { type: Type.STRING, description: "The course code if applicable (e.g., CS101)." },
        location: { type: Type.STRING, description: "Room or building." },
        durationMinutes: { type: Type.NUMBER },
    },
    required: ['activity', 'startTime', 'endTime', 'type']
};

const smartPlanSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            day: { type: Type.STRING, description: "Full day name (e.g., Monday)." },
            slots: { type: Type.ARRAY, items: planSlotSchema }
        },
        required: ['day', 'slots']
    }
};

const quizSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Required for MCQ. List of 4 distinct options." },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            hint: { type: Type.STRING, description: "For MCQ only: a Socratic nudge without revealing the answer." },
            topic: { type: Type.STRING },
            type: { type: Type.STRING },
        },
        required: ['question', 'correctAnswer', 'explanation', 'topic', 'type']
    }
};

const flashcardSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            front: { type: Type.STRING, description: "A concise term, concept, or question." },
            back: { type: Type.STRING, description: "A clear, complete explanation or answer." },
            topic: { type: Type.STRING, description: "The subject topic this card belongs to." },
            hint: { type: Type.STRING, description: "An optional short memory hint." },
        },
        required: ['front', 'back', 'topic']
    }
};

const graphSolutionSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: { type: Type.STRING },
        graphFunction: {
            type: Type.STRING,
            description: "A valid JavaScript mathematical expression using 'x' as variable and Math prefix for functions."
        },
        suggestedTitle: { type: Type.STRING },
    },
    required: ['explanation', 'graphFunction']
};

// ============================================
// FAST PARSER
// ============================================

const parseJSON = <T>(response: GenerateContentResponse, fallback?: T): T => {
    try {
        let text = (response.text || '').trim();
        if (text.startsWith('```')) {
            const start = text.indexOf('{') !== -1 ? text.indexOf('{') : text.indexOf('[');
            const end = text.lastIndexOf('}') !== -1 ? text.lastIndexOf('}') : text.lastIndexOf(']');
            if (start !== -1 && end !== -1) text = text.substring(start, end + 1);
        }
        try {
            let cleanText = text.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
            cleanText = cleanText.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
            return JSON.parse(cleanText) as T;
        } catch {
            return JSON.parse(text) as T;
        }
    } catch (e) {
        if (fallback !== undefined) return fallback;
        throw new Error("Failed to parse AI response");
    }
};

// ============================================
// SMART PLAN GENERATION
// ============================================

export const generateSmartPlan = async (
    lectures: Lecture[],
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string,
    userDetails: UserDetails
): Promise<SmartPlan> => {
    const prompt = `You are an elite academic scheduling AI. Create a complete weekly study timetable for this student.

STUDENT PROFILE: ${userDetails.name}, ${userDetails.educationalLevel} at ${userDetails.institution || 'university'}.
UNIVERSITY LECTURES: ${JSON.stringify(lectures)}
STUDY GOALS: ${JSON.stringify(studyGoals)}
PERSONAL AGENDA: ${JSON.stringify(agendaItems)}
GENERAL GOALS: ${generalGoals}

RULES:
1. Schedule ALL lectures at their exact times on the correct days.
2. For each lecture, add at least one study session for that subject within 24 hours.
3. Include short breaks (10–15 min) after every 90 min of study.
4. Distribute personal agenda items appropriately.
5. Fill remaining slots with balanced study time and free periods.
6. Keep a realistic pace — don't over-schedule.
7. Return ALL 7 days (Monday to Sunday).

Return ONLY the JSON array.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: smartPlanSchema,
                safetySettings,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return parseJSON<SmartPlan>(response, []);
    });
};

export const generatePlanFromImage = async (
    image: ImagePart,
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string,
    userDetails: UserDetails
): Promise<SmartPlan> => {
    const prompt = `Extract the lecture timetable from this image and create a complete weekly study plan.

STUDENT: ${userDetails.name}, ${userDetails.educationalLevel}.
STUDY GOALS: ${JSON.stringify(studyGoals)}
PERSONAL AGENDA: ${JSON.stringify(agendaItems)}
GENERAL GOALS: ${generalGoals}

1. Extract ALL lectures from the image with exact times and days.
2. Add study sessions for each subject.
3. Add breaks and free time.
4. Return ALL 7 days. Return ONLY the JSON array.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: { parts: [{ text: prompt }, image] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: smartPlanSchema,
                safetySettings,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return parseJSON<SmartPlan>(response, []);
    });
};

export const isImageTimetable = async (image: ImagePart): Promise<boolean> => {
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: LITE_MODEL,
            contents: { parts: [{ text: 'Is this image a class timetable or academic schedule? Reply ONLY: true or false' }, image] },
            config: { safetySettings, maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || '').toLowerCase().includes('true');
    });
};

export const isStudyMaterial = async (file: ImagePart, options?: { fast: boolean }): Promise<boolean> => {
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: LITE_MODEL,
            contents: { parts: [{ text: 'Is this educational or academic study material (lecture notes, textbook, slides, etc.)? Reply ONLY: true or false' }, file] },
            config: { safetySettings, maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || '').toLowerCase().includes('true');
    });
};

export const isImageAProblem = async (image: ImagePart): Promise<boolean> => {
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: LITE_MODEL,
            contents: { parts: [{ text: 'Does this image contain a math, science, or academic problem to solve? Reply ONLY: true or false' }, image] },
            config: { safetySettings, maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || '').toLowerCase().includes('true');
    });
};

export const getDocumentContext = async (file: ImagePart, options?: { fast: boolean }): Promise<string> => {
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: LITE_MODEL,
            contents: { parts: [{ text: 'In 10 words or less, what subject/topic is this document about? Be specific (e.g. "Calculus: Integration by Parts").' }, file] },
            config: { safetySettings, maxOutputTokens: 30, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || 'study material').trim();
    });
};

// ============================================
// DEEP ANALYSIS — uses Flash (Pro has no free tier)
// ============================================

export const deepAnalyseDocument = async (file: ImagePart, context: string): Promise<string> => {
    const prompt = `You are a world-class academic analyst and exam coach. Perform a COMPREHENSIVE DEEP ANALYSIS of this ${context} document. This is the most important analysis the student will use to study, so be exhaustive and leave nothing out.

## 📊 Document Overview
- Subject area and specific topic
- Difficulty level (Beginner / Intermediate / Advanced / Expert)
- Estimated study time to master this material
- Key prerequisites

## 🗺️ Complete Concept Map
List every single concept, term, theorem, law, formula, and idea in this document — organised by sub-topic. This should be a complete inventory, not a selection.

## 📐 All Formulas & Equations
Every formula, equation, or mathematical relationship in the document. For each:
- Name of the formula
- The formula itself (in LaTeX)
- What each variable represents
- When to use it
- A worked example

## 🧠 Deep Concept Explanations
For each major concept:
- **Definition** (precise and complete)
- **Intuitive explanation** (plain language analogy)
- **Real-world application**
- **Common exam angle** (how this is typically tested)

## 🔗 Relationships & Dependencies
How do the concepts relate to and depend on each other? Draw out the logical flow of ideas.

## ⚡ Exam Intelligence
- Most likely exam question types for this material
- High-value topics (most frequently tested)
- Tricky areas where students commonly lose marks
- 5 sample exam questions with full solutions

## 📝 Ultimate Study Checklist
A checklist of everything the student must be able to do to fully master this material.

Use markdown. Be exhaustive. This is a premium academic analysis.`;

    // NOTE: Using FLASH_MODEL not PRO_MODEL — Pro has no free tier and causes 429
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: { parts: [{ text: prompt }, file] },
            config: { safetySettings, maxOutputTokens: 6000 },
        });
        return (response.text || '').trim();
    });
};

export const verifyAndExtract = async (file: ImagePart): Promise<{ isValid: boolean; text: string }> => {
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    { text: `Respond with a JSON object ONLY: {"valid": true/false, "text": "<extracted content>"}
- "valid": true if this is educational/academic material, false otherwise
- "text": if valid=true, transcribe ALL text from every page/slide preserving structure; if valid=false, set to ""
- No markdown, no backticks, raw JSON only` },
                    file
                ]
            },
            config: { safetySettings, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } },
        });
        try {
            const raw = (response.text || '').trim().replace(/^```json\n?|^```\n?|```$/g, '').trim();
            const parsed = JSON.parse(raw);
            return { isValid: !!parsed.valid, text: parsed.text || '' };
        } catch {
            const text = (response.text || '').trim();
            return { isValid: text.length > 30, text };
        }
    });
};

// ============================================
// DOCUMENT PROCESSING — Learning Hub
// ============================================

export const summarizeDocument = async (file: ImagePart, context: string, options?: { fast: boolean }): Promise<string> => {
    const prompt = `You are an expert academic tutor and analyst. Analyse this ${context} material thoroughly and produce a world-class structured summary.

Your summary MUST include ALL of these sections — do not skip any:

## 📌 Core Topic
One clear sentence stating exactly what this document is about.

## 🎯 Key Concepts & Definitions
List every important term, concept, or principle with a concise definition. Use bullet points. Include ALL definitions the student needs.

## 📐 Formulas & Rules (if applicable)
List every formula, equation, law, or rule — written clearly with what each symbol means.

## 🧩 Main Ideas (Chapter by Chapter / Section by Section)
Break the document into logical sections. For each section write:
- **Section title**
- 2–4 bullet points covering the main ideas in that section

## 🔗 How the Concepts Connect
Explain in 2–4 sentences how the ideas in this document relate to each other. Show the big picture.

## ⚠️ Common Mistakes Students Make
List 3–5 specific errors or misconceptions students often have about this topic.

## 🧠 What to Memorise
A short, prioritised list of the most important things the student must remember for an exam.

Use markdown formatting. Be thorough, accurate, and exam-focused.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: { parts: [{ text: prompt }, file] },
            config: { safetySettings, maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || '').trim();
    });
};

export const explainDocument = async (file: ImagePart, context: string, options?: { fast: boolean }): Promise<string> => {
    const prompt = `You are a brilliant, patient teacher. Your job is to explain this ${context} material so clearly that even a complete beginner can understand it — while still being rigorous enough for a university student.

Structure your explanation like this:

## 🌍 The Big Picture (Why This Matters)
In 2–3 sentences, explain why this topic exists and why it is important in the real world or in this field of study.

## 🧱 Building Blocks (What You Need to Know First)
List any prerequisite knowledge or concepts the student should already know, with a brief reminder of each.

## 📖 The Explanation (Step by Step)
Walk through the material from the very beginning. Explain each concept one at a time using:
- **Plain language** (no unnecessary jargon)
- **Concrete examples** and **analogies** for every abstract idea
- **Real-world applications** where possible

## 🔍 Worked Examples
Provide at least 2 worked examples that show how the concepts are actually applied. Show all steps clearly.

## 💡 Simple Rules to Remember
Turn the hardest ideas into simple, memorable rules or mnemonics the student can actually use.

## ❓ Check Your Understanding
Write 3 short questions the student can ask themselves to verify they understood the material. Provide the answers below each question.

Be warm, encouraging, and extremely clear. Use markdown formatting.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: { parts: [{ text: prompt }, file] },
            config: { safetySettings, maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || '').trim();
    });
};

export const extractTextFromDocument = async (file: ImagePart, options?: { fast: boolean }): Promise<string> => {
    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: {
                parts: [
                    { text: "Transcribe ALL text from this document. Preserve headings, bullets, formulas, and labels. Separate pages with: --- Page N ---. Output ONLY the transcription." },
                    file
                ]
            },
            config: { safetySettings, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } },
        });
        return (response.text || '').trim();
    });
};

// ============================================
// CHAT & STREAMING — Learning Hub
// ============================================

export const chatWithDocumentStream = async (
    file: ImagePart | null,
    userMessage: string,
    history: ChatTurn[],
    context: string,
    smartPlan?: SmartPlan | null
) => {
    const chatHistory = history.map(turn => ([
        { role: 'user', parts: [{ text: turn.user }] },
        { role: 'model', parts: [{ text: turn.blay }] }
    ])).flat();

    const systemInstruction = `You are Blay, an elite AI academic tutor built into EduBlay — a study platform for students across Ghana, West Africa, and beyond. You are deeply knowledgeable, patient, encouraging, and exam-focused.

DOCUMENT CONTEXT: "${context}"
${smartPlan ? `STUDENT'S STUDY SCHEDULE: ${JSON.stringify(smartPlan)}` : ''}

YOUR CORE BEHAVIOUR:
1. Always answer based on the uploaded document first. If the question goes beyond it, draw on your full knowledge but say so.
2. Give structured, thorough answers. Use headers, bullet points, numbered steps, and tables where they aid clarity.
3. Use LaTeX for ALL mathematical expressions. For visual math rendering, use inline ($...$) or block ($$...$$). 
   CRITICAL FOR LATEX CODE: If the user asks for "LaTeX code" to copy/paste/compile, or if you are outputting a full LaTeX document/script, you MUST wrap it completely inside a markdown code block (i.e. \`\`\`latex \n <code here> \n\`\`\`). This ensures it renders in a black background with a copy button for the student.
4. When explaining concepts, always: define the term → give an example → connect it to the bigger picture.
5. If a student seems confused, break your explanation into even smaller steps and use a different analogy.
6. Proactively anticipate follow-up questions and address them.
7. When relevant, link concepts to exam strategies (e.g., "In an exam, this question would likely ask you to...").
8. Be encouraging but honest. If an answer is wrong, explain exactly why and guide the student to the correct reasoning.
9. If the student asks for a quiz, create 3–5 targeted questions based on the document.
10. Keep track of what the student has asked so far in this session and build on it.

TONE: Friendly, confident, expert. Like a brilliant older sibling who is also a professor.`;

    const userParts: any[] = [{ text: userMessage }];
    if (file) userParts.push(file);
    const contents: any = [...chatHistory, { role: 'user', parts: userParts }];

    return withRetry(async () =>
        ai.models.generateContentStream({
            model: FLASH_MODEL,
            contents,
            config: { systemInstruction, safetySettings, thinkingConfig: { thinkingBudget: 0 } }
        })
    );
};

// ============================================
// QUIZ & EVALUATION
// ============================================

export const evaluateConceptualAnswer = async (question: string, expectedAnswer: string, studentAnswer: string): Promise<{ isCorrect: boolean; feedback: string }> => {
    try {
        const prompt = `You are marking a student's answer to a conceptual question.
Question: "${question}"
Expected Answer: "${expectedAnswer}"
Student's Answer: "${studentAnswer}"

Evaluate the student's answer. Does it capture the core concept of the expected answer?
Respond ONLY with a JSON object in this exact format:
{"isCorrect": true/false, "feedback": "Brief explanation of why it is correct or incorrect."}`;

        const response = await withRetry(() => ai.models.generateContent({
            model: LITE_MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 0 }
            }
        }));

        const text = (response.text || '').trim().replace(/```json|```/g, '');
        const result = JSON.parse(text);
        return {
            isCorrect: !!result.isCorrect,
            feedback: result.feedback || 'No feedback provided.'
        };
    } catch {
        return {
            isCorrect: (studentAnswer || '').toLowerCase().trim() === (expectedAnswer || '').toLowerCase().trim(),
            feedback: 'Failed to evaluate with AI. Used exact text matching.'
        };
    }
};

export const generateQuiz = async (context: string, numQuestions: number, quizType: QuizType, focusArea: string, difficulty: 'easy' | 'moderate' | 'hard' = 'moderate'): Promise<QuizQuestion[]> => {
    const difficultyGuide = {
        easy: `DIFFICULTY: EASY — Test basic recall and recognition.
- Questions should test straightforward definitions and key facts
- MCQ distractors should be clearly wrong (but not silly)
- Theory/Conceptual answers should be short and direct`,
        moderate: `DIFFICULTY: MODERATE — Test understanding and application.
- Questions should require the student to understand concepts, not just memorize
- MCQ distractors should be plausible but clearly distinguishable on reflection
- Theory/Conceptual answers should show reasoning, not just facts`,
        hard: `DIFFICULTY: HARD — Test analysis, synthesis, and critical thinking.
- Questions should require comparing, evaluating, or applying concepts in new situations
- MCQ distractors should be highly plausible and require careful discrimination
- Theory/Conceptual answers should demonstrate deep insight and multi-step reasoning`,
    };

    const prompt = `Act as an expert academic examiner. Generate ${numQuestions} questions of type '${quizType}'.
${focusArea ? `Focus on: ${focusArea}.` : ''}
${difficultyGuide[difficulty]}
Context Material: ${context.substring(0, 12000)}.

**EXAM REQUIREMENTS FOR EACH TYPE:**
- **MCQ (Multiple Choice):** Create exactly 4 plausible options for each question. The correctAnswer MUST be one of the options. Also include a 'hint' field: a SHORT Socratic question or observation (max 15 words) that nudges the student to think — do NOT reference the answer, do NOT say which option is right, just point at the relevant concept or ask a guiding question.
- **THEORY (Theory-based):** Create complex, descriptive questions. Set the 'options' field to null or empty array. CorrectAnswer should be a detailed model answer. No hint needed.
- **CONCEPTUAL (Deep Thinking):** Create challenging questions that require high-level reasoning. These can be deep-thinking MCQs (with options and hint) or advanced Theory prompts.

Return ONLY the JSON array following the provided schema.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: quizSchema,
                temperature: difficulty === 'hard' ? 0.6 : difficulty === 'easy' ? 0.8 : 0.7,
                safetySettings,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return parseJSON<QuizQuestion[]>(response, []);
    });
};

// ============================================
// SOLVER & COACHING
// ============================================

export const solveProblem = async (
    questionText: string,
    imagePart: ImagePart | null,
    outputFormat: string,
    programmingLanguage: string,
    graphInterval?: string,
    graphYInterval?: string
): Promise<string> => {
    let prompt = `Solve this academic problem with absolute precision.
Question: ${questionText}.
Format Required: ${outputFormat}. 

**INSTRUCTIONS:**
- If format is 'steps', provide clear logical progression using Markdown and LaTeX.
- If format is 'latex', you MUST wrap the LaTeX code completely inside a Markdown code block (i.e. \`\`\`latex\n<code here>\n\`\`\`). The code must be accurate and complete so the student can run/compile it. Do NOT output raw LaTeX without the backticks.
- If format is 'code', provide efficient ${programmingLanguage} code, and MUST wrap it completely inside a Markdown code block (e.g. \`\`\`${programmingLanguage}\n<code here>\n\`\`\`).
- If format is 'graph', you MUST provide a JSON object with:
    1. 'explanation': Step-by-step logic.
    2. 'graphFunction': A valid JavaScript expression for 'Math' object evaluation, e.g., "Math.sin(x) * 2". 
       If multiple functions, return them as a comma-separated string or array.
    3. 'suggestedTitle': A title for the chart.

${graphInterval ? `X-Range requested: ${graphInterval}` : ''} 
${graphYInterval ? `Y-Range requested: ${graphYInterval}` : ''}.`;

    const parts: any[] = [{ text: prompt }];
    if (imagePart) parts.push(imagePart);

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: { parts },
            config: {
                safetySettings,
                thinkingConfig: { thinkingBudget: 0 },
                ...(outputFormat === 'graph' ? { responseMimeType: 'application/json', responseSchema: graphSolutionSchema } : {})
            }
        });
        return (response.text || '').trim();
    });
};

export const generateWeeklyProgressComment = async (userDetails: UserDetails, data: any): Promise<string> => {
    const prompt = `Act as Blay, a critical yet motivational Academic Performance Analyst.
Review ${userDetails.name}'s progress data: ${JSON.stringify(data)}.

**YOUR TASKS:**
1. ANALYZE the 'tracked' vs 'scheduled' hours. If they are falling behind, be firm but encouraging.
2. IDENTIFY 'Neglected Subjects'. If a subject has 0 or low tracked hours compared to its schedule, call it out.
3. PROVIDE actionable coaching. Give 1 specific strategy (e.g. Pomodoro, active recall) based on their current load.
4. KEEP it concise: 3-4 sentences total.
5. NO markdown bolding (**). Plain text only.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: LITE_MODEL,
            contents: prompt,
            config: {
                safetySettings,
                maxOutputTokens: 250,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return (response.text || '').trim();
    });
};

// ============================================
// FLASHCARD GENERATION
// ============================================

export interface Flashcard {
    front: string;
    back: string;
    topic: string;
    hint?: string;
}

export const generateFlashcards = async (context: string, numCards: number, focusArea: string, difficulty: 'easy' | 'moderate' | 'hard' = 'moderate'): Promise<Flashcard[]> => {
    const difficultyGuide = {
        easy: `DIFFICULTY: EASY
- FRONT: Simple, direct terms or basic definitions (e.g. "What is photosynthesis?")
- BACK: Short, clear, single-sentence answers with no technical jargon
- HINT: Always include a simple memory trick or analogy
- Avoid complex multi-part concepts`,
        moderate: `DIFFICULTY: MODERATE
- FRONT: Conceptual questions that require some understanding (e.g. "How does X relate to Y?")
- BACK: 2-3 sentence explanations with some detail
- HINT: Include a helpful connection or mnemonic where useful
- Mix definitions with application questions`,
        hard: `DIFFICULTY: HARD
- FRONT: Deep analytical or application questions (e.g. "Why does X happen and what are the consequences?")
- BACK: Detailed, multi-part answers demonstrating deep understanding; include mechanisms, causes, effects
- HINT: Only include hints for the most complex cards
- Focus on edge cases, comparisons, and synthesis across topics`,
    };

    const prompt = `Act as an expert educator. Create ${numCards} high-quality flashcards from the study material below.
${focusArea ? `Focus specifically on: ${focusArea}.` : ''}
${difficultyGuide[difficulty]}

Study Material: ${context.substring(0, 12000)}

Rules:
- Each card must cover a DISTINCT concept — no repetition
- Cards must match the difficulty level strictly
- Return ONLY the JSON array.`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: flashcardSchema,
                temperature: difficulty === 'hard' ? 0.5 : difficulty === 'easy' ? 0.7 : 0.6,
                safetySettings,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        return parseJSON<Flashcard[]>(response, []);
    });
};