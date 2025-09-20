import { GoogleGenAI, Type } from "@google/genai";
import { UserDetails, StudyGoal, Lecture, AgendaItem, SmartPlan, ImagePart, DayOfWeek, ActivityType, QuizType, QuizQuestion, AnswerFeedback, QuizSummary, ChatTurn } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const planSlotSchema = {
    type: Type.OBJECT,
    properties: {
        activity: { type: Type.STRING, description: "The name of the activity, e.g., 'Calculus 101 Lecture', 'Study Physics', 'Gym'." },
        startTime: { type: Type.STRING, description: "The start time in 'HH:MM AM/PM' format (e.g., '09:00 AM')." },
        endTime: { type: Type.STRING, description: "The end time in 'HH:MM AM/PM' format (e.g., '10:00 AM')." },
        type: {
            type: Type.STRING,
            description: `The type of activity. Must be one of: ${Object.values(ActivityType).join(', ')}.`
        },
        link: { type: Type.STRING, description: "An optional relevant link for the activity (e.g., a YouTube link for a break)." },
    },
    required: ["activity", "startTime", "endTime", "type"],
};

const dayPlanSchema = {
    type: Type.OBJECT,
    properties: {
        day: {
            type: Type.STRING,
            description: `The day of the week. Must be one of: ${Object.values(DayOfWeek).join(', ')}.`
        },
        slots: {
            type: Type.ARRAY,
            items: planSlotSchema,
            description: "A list of time slots for the day."
        },
    },
    required: ["day", "slots"],
};

const smartPlanSchema = {
    type: Type.ARRAY,
    items: dayPlanSchema,
};

function buildBasePrompt(
    userDetails: UserDetails,
    studyGoals: StudyGoal[],
    generalGoals: string
): string {
    let prompt = `You are an expert academic planner. Create a personalized weekly timetable (Smart Plan) for a student with the following details:\n`;
    prompt += `- Name: ${userDetails.name}\n`;
    prompt += `- Educational Level: ${userDetails.educationalLevel}\n`;
    if (userDetails.institution) prompt += `- Institution: ${userDetails.institution}\n`;
    if (userDetails.country) prompt += `- Country: ${userDetails.country}\n`;

    prompt += "\n**Student's Schedule & Goals:**\n";

    if (studyGoals.length > 0) {
        prompt += "- Study Goals:\n";
        studyGoals.forEach(g => {
            prompt += `  - ${g.subject}: ${g.hours} hours/week. ${g.materials ? `(Materials: ${g.materials})` : ''}\n`;
        });
    }

    if (generalGoals) {
        prompt += `- General Goals for the week: ${generalGoals}\n`;
    }

    prompt += "\n**Instructions:**\n"
    prompt += "1. Create a structured timetable for all 7 days of the week (Monday to Sunday).\n";
    prompt += "2. Allocate study sessions for the specified subjects, distributing the required hours throughout the week.\n";
    prompt += "3. Schedule personal agenda items at their specified times.\n";
    prompt += "4. Integrate short breaks (5-15 mins) between study sessions and longer breaks (30-60 mins) for meals.\n";
    prompt += "5. Fill any remaining time with 'Free Time' slots, but also ensure there are reasonable gaps for meals (e.g., Lunch, Dinner) which can be marked as 'agenda'.\n";
    prompt += "6. The final output must be a valid JSON array matching the provided schema. Do not include any explanatory text or markdown formatting outside of the JSON structure.\n";
    prompt += "7. Ensure start and end times are logical and do not overlap within a day. Assume a typical student schedule, planning activities from morning to evening.\n";

    return prompt;
}

async function generatePlan(prompt: string, imagePart?: ImagePart): Promise<SmartPlan> {
    try {
        // FIX: Corrected the structure of the 'contents' property for multipart requests to align with the Gemini API SDK.
        const contents = imagePart ? { parts: [imagePart, { text: prompt }] } : prompt;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: smartPlanSchema,
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const jsonText = response.text.trim();
        const plan: SmartPlan = JSON.parse(jsonText);
        return plan;
    } catch (error) {
        console.error("Error generating smart plan:", error);
        if (error instanceof Error) {
             throw new Error(`Failed to generate plan. The model returned an invalid response. Details: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating the plan.");
    }
}

export const isImageTimetable = async (imagePart: ImagePart): Promise<boolean> => {
    try {
        const prompt = "Analyze this image and determine if it is a timetable or a schedule. A timetable typically contains days, times, and subjects/activities in a structured grid or list format. Answer with a single word: 'yes' if it is a timetable, and 'no' if it is not.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, { text: prompt }] },
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        const resultText = response.text.trim().toLowerCase();
        return resultText === 'yes';
    } catch (error) {
        console.error("Error verifying image:", error);
        return false;
    }
};

export const isStudyMaterial = async (filePart: ImagePart): Promise<boolean> => {
    try {
        const prompt = "Analyze the content of this document. Is it likely to be educational material for a student, such as lecture slides, a textbook, academic notes, or a research paper? Please disregard any timetables or schedules. Answer with a single word: 'yes' if it is educational material, or 'no' if it is not.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        const resultText = response.text.trim().toLowerCase();
        return resultText.includes('yes');
    } catch (error) {
        console.error("Error verifying study material:", error);
        return false;
    }
};

export const getDocumentContext = async (filePart: ImagePart): Promise<string> => {
    try {
        const prompt = "Analyze the provided document and identify its primary subject matter in one or two words. Examples: Mathematics, European History, Cell Biology, Computer Science, English Literature, Contract Law. If the subject is unclear or too broad, respond with 'General'.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error identifying document context:", error);
        return "General";
    }
};

export const analyzeDocument = async (prompt: string, filePart: ImagePart): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing document:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to analyze the document. Details: ${error.message}`);
        }
        throw new Error("An unknown error occurred while analyzing the document.");
    }
};

const generateSpecializedPrompt = (baseAction: 'summarize' | 'explain', context: string): string => {
    let prompt;

    if (baseAction === 'summarize') {
        prompt = 'Provide a concise summary of this document, suitable for a university student preparing for an exam.';
    } else { // explain
        prompt = 'Explain the key concepts in this document in a simple, step-by-step manner, as if you were tutoring a peer.';
    }

    prompt += " IMPORTANT FORMATTING AND CONTENT RULES:\n";
    prompt += "1. For mathematical formulas, use LaTeX notation. Use double dollar signs ($$ ... $$) for display-style equations on their own line. Use single dollar signs ($ ... $) for inline formulas within a sentence, for example: 'The value is $\\alpha$'.\n";
    prompt += "2. To emphasize specific terms or keywords, enclose them in double asterisks, like this: **keyword**. Do not use bold for entire sentences.\n";
    prompt += "3. For mathematical problems, provide a clear **step-by-step solution**.\n";
    prompt += "4. When explaining a formula, first present it using LaTeX, then **explain each variable and component**. If relevant, briefly describe its derivation.\n";
    prompt += "5. If the document contains a mathematical function that is being explained or summarized, you MUST provide a visualization by outputting a special JSON block on its own line. The format is: {\"graph\": {\"function\": \"x**2 + 2*x - 3\", \"domain\": [-10, 10]}}. Use JavaScript-compatible math syntax (e.g., `**` for exponents, `Math.sin()`). Always provide a reasonable domain for plotting.\n";

    const lowerContext = context.toLowerCase();
    if (lowerContext.includes('math')) {
        prompt += " Pay special attention to defining formulas, explaining theorems, and breaking down multi-step problem solutions.";
    } else if (lowerContext.includes('history')) {
        prompt += " Focus on key dates, historical figures, significant events, and their causal relationships. Present information chronologically where it makes sense.";
    } else if (lowerContext.includes('science') || lowerContext.includes('biology') || lowerContext.includes('chemistry') || lowerContext.includes('physics')) {
        prompt += " Emphasize core scientific concepts, definitions, experimental processes, and the logical flow of information.";
    } else if (lowerContext.includes('law') || lowerContext.includes('legal')) {
        prompt += " Clearly define legal terminology, summarize case precedents or statutory provisions, and outline the structure of legal arguments.";
    } else if (lowerContext.includes('literature')) {
        prompt += " Identify major themes, character development, plot structure, and significant literary devices used by the author.";
    }

    return prompt;
};

export const summarizeDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = generateSpecializedPrompt('summarize', context);
    return analyzeDocument(prompt, filePart);
};

export const explainDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = generateSpecializedPrompt('explain', context);
    return analyzeDocument(prompt, filePart);
};

export const chatWithDocumentStream = async (
    filePart: ImagePart,
    question: string,
    chatHistory: ChatTurn[],
    context: string
) => {
    const systemInstruction = `You are Blay, an advanced AI study assistant with a friendly, encouraging, and slightly informal personality. Your primary goal is to help a student understand the provided document about **${context}**.

**PRIMARY DIRECTIVE:**
Your responses MUST be based *only* on the information within the provided document. If the answer isn't in the document, you MUST politely state that you can't find the information in the provided material.

**CORE ACADEMIC CAPABILITIES:**
When a user's question relates to content within the document, you MUST use the following capabilities:

1.  ✨ **LaTeX Formula Rendering:** If the document contains math, render it using LaTeX. Use display style ($$ ... $$) for equations on their own line and inline style ($ ... $) for formulas within text.

2.  **Step-by-Step Problem Solving:** If the document contains a mathematical problem and the user asks for a solution, you MUST solve it by providing a clear **step-by-step solution**. Break down each part of the process logically.

3.  **Interactive Graphing:** If the conversation involves a mathematical function, either from the document or derived during the explanation, you MUST offer a visualization. To do this, output a special JSON block on its own line. This is mandatory whenever a function is discussed. The format is: {"graph": {"function": "x**2", "domain": [-10, 10]}}. Use JavaScript-compatible math syntax (e.g., \`**\` for exponents, \`Math.sin()\` for sine). Always provide a reasonable domain for plotting.

4.  **Formula Explanation & Derivation:** If the user asks about a formula from the document, you MUST first present it using LaTeX. Then, **explain each variable and component** clearly. If the derivation is available in the document or can be reasonably inferred, provide a brief derivation.

**CONVERSATIONAL SKILLS:**
- You understand conversational language, including common slang and abbreviations (e.g., "idk", "lol", "cuz").
- You keep track of the conversation context to provide relevant answers.
- You detect the user's intent (e.g., asking for a definition, an example, or a summary) and provide the most helpful response based on the document.

**ABSOLUTE RULE:**
- You MUST NOT create quizzes, tests, or questions if asked. Instead, you MUST politely decline and redirect the user to the "Exam Prep" section of the app. For example, say: "I can help with explanations based on your material here, but for quizzes, please head over to the 'Exam Prep' section. It's designed for that!"`;

    const contents: any[] = [];

    // Construct history for the API call
    chatHistory.forEach((turn, index) => {
        const userParts: any[] = [];
        // Only include the document image in the very first turn to provide context initially.
        if (index === 0) {
            userParts.push(filePart);
        }
        userParts.push({ text: turn.user });
        contents.push({ role: 'user', parts: userParts });

        contents.push({ role: 'model', parts: [{ text: turn.blay }] });
    });

    // Add the current user question
    const currentUserParts: any[] = [];
    // If there's no history, this is the first message, so it needs the document.
    if (chatHistory.length === 0) {
        currentUserParts.push(filePart);
    }
    currentUserParts.push({ text: question });
    contents.push({ role: 'user', parts: currentUserParts });

    try {
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return responseStream;
    } catch (error) {
        console.error("Error analyzing document for chat stream:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to stream chat response. Details: ${error.message}`);
        }
        throw new Error("An unknown error occurred while streaming the chat response.");
    }
};

export const extractTextFromDocument = async (filePart: ImagePart): Promise<string> => {
    try {
        const prompt = "Extract all text content from the document. Do not summarize, translate, or alter it. Return only the raw text, preserving paragraph breaks.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
        });
        return response.text;
    } catch (error) {
        console.error("Error extracting text:", error);
        throw new Error("Failed to extract text from the document.");
    }
};

export const generateSmartPlan = async (
    userDetails: UserDetails,
    lectures: Lecture[],
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string
): Promise<SmartPlan> => {
    let prompt = buildBasePrompt(userDetails, studyGoals, generalGoals);

    if (lectures.length > 0) {
        prompt += "- Fixed Lectures:\n";
        lectures.forEach(l => {
            prompt += `  - ${l.subject} on ${l.day} from ${l.startTime} to ${l.endTime}${l.location ? ` at ${l.location}` : ''}.\n`;
        });
    }

    if (agendaItems.length > 0) {
        prompt += "- Personal Agenda:\n";
        agendaItems.forEach(a => {
            prompt += `  - ${a.title} on ${a.day} from ${a.startTime} to ${a.endTime}.\n`;
        });
    }

    return generatePlan(prompt);
};


export const generatePlanFromImage = async (
    userDetails: UserDetails,
    studyGoals: StudyGoal[],
    generalGoals: string,
    imagePart: ImagePart
): Promise<SmartPlan> => {
    let prompt = buildBasePrompt(userDetails, studyGoals, generalGoals);
    prompt += "\n**IMPORTANT IMAGE INSTRUCTIONS:**\n";
    prompt += "An image of the student's current timetable is attached. Your primary task is to meticulously extract all fixed events (like lectures, labs, or appointments) along with their precise days and times from this image.\n";
    prompt += "These extracted events are **NON-NEGOTIABLE** and **MUST** be placed in the schedule exactly as they appear in the image. Do not alter their times or days.\n";
    prompt += "After placing these fixed events, schedule the student's study goals and personal agenda items into the remaining available time slots. Fill any other gaps with breaks and free time. The timetable from the image is the rigid foundation of the new plan.\n";
    return generatePlan(prompt, imagePart);
};

// --- Exam Prep Service Functions ---

const mcqSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.STRING, description: "The correct answer string, which must be one of the values from the 'options' array." },
        explanation: { type: Type.STRING, description: "A brief explanation for why the answer is correct." },
        topic: { type: Type.STRING, description: "The main topic or concept this question is testing (e.g., 'Photosynthesis', 'Newton's First Law')." },
    },
    required: ["question", "options", "correctAnswer", "explanation", "topic"],
};

const openEndedSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        correctAnswer: { type: Type.STRING, description: "The correct answer to the question." },
        explanation: { type: Type.STRING, description: "A brief explanation for the correct answer." },
        topic: { type: Type.STRING, description: "The main topic or concept this question is testing (e.g., 'Photosynthesis', 'Newton's First Law')." },
    },
    required: ["question", "correctAnswer", "explanation", "topic"],
};

export const generateQuiz = async (
    filePart: ImagePart,
    quizType: QuizType,
    scope: string,
    questionCount: number = 5
): Promise<QuizQuestion[]> => {
    const questionTypeString = quizType === QuizType.MCQ ? 'multiple choice questions with 4 options each' : quizType === QuizType.CONCEPTUAL ? 'conceptual questions that test deep understanding' : 'theory-based questions';
    const prompt = `You are a quiz master. Based on the provided document, generate ${questionCount} ${questionTypeString}. The questions should focus on the following topic or page range: "${scope}". For each question, you MUST provide the correct answer, a brief explanation, and the main 'topic' it covers. For multiple choice questions, the 'correctAnswer' field must be one of the strings from the 'options' array. Ensure the questions are relevant and challenging. Return only the JSON array.`;
    
    let responseSchema;
    if (quizType === QuizType.MCQ) {
        responseSchema = { type: Type.ARRAY, items: mcqSchema };
    } else {
        responseSchema = { type: Type.ARRAY, items: openEndedSchema };
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });
        const jsonText = response.text.trim();
        const questions = JSON.parse(jsonText);
        // Add the 'type' field to each question object
        return questions.map((q: any) => ({ ...q, type: quizType }));
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate the quiz. The model may have returned an unexpected format.");
    }
};