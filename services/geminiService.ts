// FIX: Implement Gemini service to resolve import errors and provide core functionality.
import { GoogleGenAI, Type } from "@google/genai";
// FIX: Added .ts extension to import path.
import { UserDetails, StudyGoal, Lecture, AgendaItem, SmartPlan, ImagePart, DayOfWeek, ActivityType, QuizType, QuizQuestion, AnswerFeedback, QuizSummary } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const planSlotSchema = {
    type: Type.OBJECT,
    properties: {
        activity: { type: Type.STRING, description: "The name of the activity, e.g., 'Calculus 101 Lecture', 'Study Physics', 'Gym'." },
        startTime: { type: Type.STRING, description: "The start time in 'HH:MM AM/PM' format (e.g., '09:00 AM')." },
        endTime: { type: Type.STRING, description: "The end time in 'HH:MM AM/PM' format (e.g., '10:00 AM')." },
        type: {
            type: Type.STRING,
            enum: Object.values(ActivityType),
            description: "The type of activity."
        },
        // FIX: Removed non-standard `nullable` property. Optionality is handled by not being in the `required` array.
        link: { type: Type.STRING, description: "An optional relevant link for the activity (e.g., a YouTube link for a break)." },
    },
    required: ["activity", "startTime", "endTime", "type"],
};

const dayPlanSchema = {
    type: Type.OBJECT,
    properties: {
        day: {
            type: Type.STRING,
            enum: Object.values(DayOfWeek),
            description: "The day of the week."
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
        const contents = imagePart ? { parts: [{ text: prompt }, imagePart] } : prompt;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: smartPlanSchema,
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
            contents: { parts: [ { text: prompt }, imagePart ] },
        });
        const resultText = response.text.trim().toLowerCase();
        return resultText === 'yes';
    } catch (error) {
        console.error("Error verifying image:", error);
        // Default to false on error to prevent processing invalid images
        return false;
    }
};

export const isStudyMaterial = async (filePart: ImagePart): Promise<boolean> => {
    try {
        const prompt = "Analyze the content of this document. Is it likely to be educational material for a student, such as lecture slides, a textbook, academic notes, or a research paper? Please disregard any timetables or schedules. Answer with a single word: 'yes' if it is educational material, or 'no' if it is not.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [ { text: prompt }, filePart ] },
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        const resultText = response.text.trim().toLowerCase();
        return resultText.includes('yes'); // Use .includes() for robustness
    } catch (error) {
        console.error("Error verifying study material:", error);
        return false; // Default to false on error
    }
};

export const getDocumentContext = async (filePart: ImagePart): Promise<string> => {
    try {
        const prompt = "Analyze the provided document and identify its primary subject matter in one or two words. Examples: Mathematics, European History, Cell Biology, Computer Science, English Literature, Contract Law. If the subject is unclear or too broad, respond with 'General'.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }, filePart] },
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error identifying document context:", error);
        return "General"; // Default to a general context on error
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

export const chatWithDocument = async (filePart: ImagePart, question: string, context: string): Promise<string> => {
    const prompt = `You are a helpful study assistant. The user is studying a document about **${context}**. Based *only* on the content of the provided document, answer the following question: "${question}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing document for chat:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to analyze the document. Details: ${error.message}`);
        }
        throw new Error("An unknown error occurred while analyzing the document.");
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
    prompt += "\nAn image of the student's existing timetable is provided. First, extract all lectures and their timings from the image. Then, use this information to create the complete Smart Plan as requested.\n";
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
    },
    required: ["question", "options", "correctAnswer", "explanation"],
};

const openEndedSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        correctAnswer: { type: Type.STRING, description: "The correct answer to the question." },
        explanation: { type: Type.STRING, description: "A brief explanation for the correct answer." },
    },
    required: ["question", "correctAnswer", "explanation"],
};

export const generateQuiz = async (
    filePart: ImagePart,
    quizType: QuizType,
    scope: string,
    questionCount: number = 5
): Promise<QuizQuestion[]> => {
    const questionTypeString = quizType === QuizType.MCQ ? 'multiple choice questions with 4 options each' : quizType === QuizType.CONCEPTUAL ? 'conceptual questions that test deep understanding' : 'theory-based questions';
    const prompt = `You are a quiz master. Based on the provided document, generate ${questionCount} ${questionTypeString}. The questions should focus on the following topic or page range: "${scope}". For each question, you MUST provide the correct answer and a brief explanation. For multiple choice questions, the 'correctAnswer' field must be one of the strings from the 'options' array. Ensure the questions are relevant and challenging. Return only the JSON array.`;
    
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

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER, description: "The final score as a percentage (0-100)." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of topics or concepts the user seems to understand well." },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of topics or concepts the user struggled with." },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific recommendations for sections or topics to revise based on the weaknesses." },
    },
    required: ["score", "strengths", "weaknesses", "recommendations"],
};

export const generateQuizSummary = async (
    filePart: ImagePart,
    performance: { question: string; wasCorrect: boolean }[]
): Promise<QuizSummary> => {
    const performanceString = performance.map(p => `- Question: "${p.question}" - Correct: ${p.wasCorrect}`).join('\n');
    const prompt = `Based on the provided document and the student's quiz performance below, generate a summary report.
    
    Performance:
    ${performanceString}
    
    The report should include a final score (percentage), a list of strengths, a list of weaknesses (weak spots), and specific recommendations on what to revise from the document. Return only the JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: summarySchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating summary:", error);
        throw new Error("Could not generate the quiz summary.");
    }
};