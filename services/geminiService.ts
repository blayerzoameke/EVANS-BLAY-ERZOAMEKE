// FIX: Implement Gemini service to resolve import errors and provide core functionality.
import { GoogleGenAI, Type } from "@google/genai";
import { UserDetails, StudyGoal, BreakPreference, Lecture, AgendaItem, SmartPlan, ImagePart, DayOfWeek, ActivityType, QuizType, QuizQuestion, AnswerFeedback, QuizSummary } from "../types";

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
    breakPreferences: BreakPreference[],
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

    if (breakPreferences.length > 0) {
        prompt += "- Break Preferences:\n";
        breakPreferences.forEach(b => {
            prompt += `  - ${b.activity}${b.link ? ` (${b.link})` : ''}\n`;
        });
        prompt += "Incorporate short breaks (5-15 mins) between study sessions and longer breaks (30-60 mins) for meals.\n";
    }

    if (generalGoals) {
        prompt += `- General Goals for the week: ${generalGoals}\n`;
    }

    prompt += "\n**Instructions:**\n"
    prompt += "1. Create a structured timetable for all 7 days of the week (Monday to Sunday).\n";
    prompt += "2. Allocate study sessions for the specified subjects, distributing the required hours throughout the week.\n";
    prompt += "3. Schedule personal agenda items at their specified times.\n";
    prompt += "4. Integrate preferred break activities into the schedule during break times.\n";
    prompt += "5. Fill any remaining time with 'Free Time' slots, but also ensure there are reasonable gaps for meals (e.g., Lunch, Dinner) which can be marked as 'agenda'.\n";
    prompt += "6. The final output must be a valid JSON array matching the provided schema. Do not include any explanatory text or markdown formatting outside of the JSON structure.\n";
    prompt += "7. Ensure start and end times are logical and do not overlap within a day.\n";

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

export const generateSmartPlan = async (
    userDetails: UserDetails,
    lectures: Lecture[],
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    breakPreferences: BreakPreference[],
    generalGoals: string
): Promise<SmartPlan> => {
    let prompt = buildBasePrompt(userDetails, studyGoals, breakPreferences, generalGoals);

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
    breakPreferences: BreakPreference[],
    generalGoals: string,
    imagePart: ImagePart
): Promise<SmartPlan> => {
    let prompt = buildBasePrompt(userDetails, studyGoals, breakPreferences, generalGoals);
    prompt += "\nAn image of the student's existing timetable is provided. First, extract all lectures and their timings from the image. Then, use this information to create the complete Smart Plan as requested.\n";
    return generatePlan(prompt, imagePart);
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

// --- Exam Prep Service Functions ---

const mcqSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["question", "options"],
};

const openEndedSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING },
    },
    required: ["question"],
};

export const generateQuiz = async (
    filePart: ImagePart,
    quizType: QuizType,
    scope: string,
    questionCount: number = 5
): Promise<QuizQuestion[]> => {
    const questionTypeString = quizType === QuizType.MCQ ? 'multiple choice questions with 4 options each' : quizType === QuizType.CONCEPTUAL ? 'conceptual questions that test deep understanding' : 'theory-based questions';
    const prompt = `You are a quiz master. Based on the provided document, generate ${questionCount} ${questionTypeString}. The questions should focus on the following topic or page range: "${scope}". Ensure the questions are relevant and challenging. Return only the JSON array.`;
    
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

const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        isCorrect: { type: Type.BOOLEAN },
        explanation: { type: Type.STRING, description: "A brief explanation for why the answer is correct or incorrect." },
    },
    required: ["isCorrect", "explanation"],
};

export const validateAnswer = async (
    filePart: ImagePart,
    question: QuizQuestion,
    userAnswer: string
): Promise<AnswerFeedback> => {
    const optionsString = 'options' in question && question.options ? `The options were: ${question.options.join(', ')}.` : '';
    const prompt = `I am a student taking a quiz based on the provided document.
    Question: "${question.question}"
    ${optionsString}
    My Answer: "${userAnswer}"
    
    Please evaluate my answer. Is it correct? Provide a brief explanation for why my answer is right or wrong, based *only* on the content of the document. Return only the JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [filePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: feedbackSchema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error validating answer:", error);
        throw new Error("Could not validate the answer. Please try again.");
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
