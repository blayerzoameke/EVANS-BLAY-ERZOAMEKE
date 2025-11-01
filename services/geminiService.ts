import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, ImagePart, QuizQuestion, QuizType, ChatTurn } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// FIX: HarmCategory and HarmBlockThreshold are not available in the new API. Safety settings are passed as a simple object.
const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// --- Schemas for JSON responses ---

const planSlotSchema = {
    type: Type.OBJECT,
    properties: {
        activity: { type: Type.STRING },
        startTime: { type: Type.STRING },
        endTime: { type: Type.STRING },
        type: { type: Type.STRING },
        link: { type: Type.STRING },
        code: { type: Type.STRING },
        isLocked: { type: Type.BOOLEAN },
        durationMinutes: { type: Type.NUMBER },
        location: { type: Type.STRING },
    },
    required: ['activity', 'startTime', 'endTime', 'type']
};

const dayPlanSchema = {
    type: Type.OBJECT,
    properties: {
        day: { type: Type.STRING },
        slots: {
            type: Type.ARRAY,
            items: planSlotSchema
        }
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
        options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        },
        correctAnswer: { type: Type.STRING },
        explanation: { type: Type.STRING },
        topic: { type: Type.STRING },
        type: { type: Type.STRING },
    },
    required: ['question', 'correctAnswer', 'explanation', 'topic', 'type']
};

const quizSchema = {
    type: Type.ARRAY,
    items: quizQuestionSchema
};

const graphSolutionSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: { type: Type.STRING },
        graphFunction: { type: Type.STRING },
        suggestedTitle: { type: Type.STRING },
    },
    required: ['explanation', 'graphFunction']
};


const parseGeminiResponse = <T>(response: GenerateContentResponse): T => {
    try {
        const text = response.text.trim();
        // The model should return valid JSON now with the schema, but this is a good fallback for markdown-wrapped JSON.
        const jsonStr = text.startsWith('```json') && text.endsWith('```')
            ? text.substring(7, text.length - 3)
            : text;
        return JSON.parse(jsonStr) as T;
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON", response.text, e);
        throw new Error("Failed to parse AI response. Please try again.");
    }
};

export const generateSmartPlan = async (
    userDetails: UserDetails,
    lectures: Lecture[],
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string,
    existingPlan?: SmartPlan
): Promise<SmartPlan> => {
    const prompt = `
        Create a smart study plan based on the following details. The output must be a JSON array of DayPlan objects matching the provided schema.
        UserDetails: ${JSON.stringify(userDetails)}
        Lectures: ${JSON.stringify(lectures)}
        Study Goals: ${JSON.stringify(studyGoals)}
        Personal Agenda: ${JSON.stringify(agendaItems)}
        General Goals/Preferences: ${generalGoals}
        ${existingPlan ? `This is a regeneration request. Here is the existing plan to be modified: ${JSON.stringify(existingPlan)}` : ''}
        
        Rules:
        - The output must be valid JSON matching the provided schema.
        - A DayPlan is { day: DayOfWeek; slots: PlanSlot[] }.
        - A PlanSlot is { activity: string; startTime: string; endTime: string; type: ActivityType; link?: string; code?: string; isLocked?: boolean; durationMinutes?: number; location?: string }.
        - ActivityType can be 'lecture', 'study', 'agenda', 'break', 'free'.
        - If a lecture or study goal subject contains a recognizable course code (e.g., "CS 101", "MATH203"), extract it and place it in the 'code' field of the corresponding PlanSlot. The 'activity' field should then contain the full name of the course.
        - Lectures and agenda items are fixed (isLocked: true). Build study sessions around them.
        - Allocate study time to meet the weekly study goals.
        - Schedule regular breaks.
        - Fill empty time with 'free' slots.
        - Ensure startTime and endTime are in "HH:MM AM/PM" format.
        - Do NOT include any markdown or commentary outside of the JSON.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: smartPlanSchema,
            temperature: 0.7,
            safetySettings,
        },
    });
    return parseGeminiResponse<SmartPlan>(response);
};

export const generatePlanFromImage = async (
    userDetails: UserDetails,
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string,
    image: ImagePart,
    existingPlan?: SmartPlan
): Promise<SmartPlan> => {
    const prompt = `
        First, analyze the provided timetable image to extract all lectures/classes with their subject, day, start time, end time, and location if available.
        Then, create a smart study plan based on the extracted lectures and the following details. The output must be a JSON array of DayPlan objects.

        UserDetails: ${JSON.stringify(userDetails)}
        Study Goals: ${JSON.stringify(studyGoals)}
        Personal Agenda: ${JSON.stringify(agendaItems)}
        General Goals/Preferences: ${generalGoals}
        ${existingPlan ? `This is a regeneration request. Here is the existing plan to be modified: ${JSON.stringify(existingPlan)}` : ''}
        
        Rules:
        - The output must be valid JSON matching the provided schema.
        - A DayPlan is { day: DayOfWeek; slots: PlanSlot[] }.
        - A PlanSlot is { activity: string; startTime: string; endTime: string; type: ActivityType; link?: string; code?: string; isLocked?: boolean; durationMinutes?: number; location?: string }.
        - ActivityType can be 'lecture', 'study', 'agenda', 'break', 'free'.
        - When extracting from the image, if you identify a course code (e.g., "CS 101"), place it in the 'code' field and the full course name in the 'activity' field.
        - Lectures and agenda items are fixed (isLocked: true). Build study sessions around them.
        - Allocate study time to meet the weekly study goals.
        - Schedule regular breaks.
        - Fill empty time with 'free' slots.
        - Ensure startTime and endTime are in "HH:MM AM/PM" format.
        - Do NOT include any markdown or commentary outside of the JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [{ text: prompt }, image] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: smartPlanSchema,
            temperature: 0.7,
            safetySettings,
        },
    });
    return parseGeminiResponse<SmartPlan>(response);
};

export const isImageTimetable = async (image: ImagePart): Promise<boolean> => {
    const prompt = "Does this image appear to be a school or university timetable? Respond with only 'true' or 'false'.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, image] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim().toLowerCase() === 'true';
};

export const getDocumentContext = async (file: ImagePart, options?: { fast: boolean }): Promise<string> => {
    const prompt = "What is the primary subject or topic of this document? Respond with only the subject name (e.g., 'Quantum Physics', 'British History').";
    const response = await ai.models.generateContent({
        model: options?.fast ? 'gemini-2.5-flash' : 'gemini-2.5-pro',
        contents: { parts: [{ text: prompt }, file] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim();
};

export const isStudyMaterial = async (file: ImagePart, options?: { fast: boolean }): Promise<boolean> => {
    const prompt = "Is this document likely to be educational or study material (like lecture notes, a textbook page, a research paper)? Respond with only 'true' or 'false'.";
    const response = await ai.models.generateContent({
        model: options?.fast ? 'gemini-2.5-flash' : 'gemini-2.5-pro',
        contents: { parts: [{ text: prompt }, file] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim().toLowerCase() === 'true';
};

export const summarizeDocument = async (file: ImagePart, context: string, options?: { fast: boolean }): Promise<string> => {
    const prompt = `Provide a concise summary of this document about ${context}. Focus on the key concepts, definitions, and main arguments. Use markdown for formatting.`;
    const response = await ai.models.generateContent({
        model: options?.fast ? 'gemini-2.5-flash' : 'gemini-2.5-pro',
        contents: { parts: [{ text: prompt }, file] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim();
};

export const explainDocument = async (file: ImagePart, context: string, options?: { fast: boolean }): Promise<string> => {
    const prompt = `Explain the content of this document about ${context} in a simple, easy-to-understand way. Use analogies and break down complex ideas. Use markdown for formatting.`;
    const response = await ai.models.generateContent({
        model: options?.fast ? 'gemini-2.5-flash' : 'gemini-2.5-pro',
        contents: { parts: [{ text: prompt }, file] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim();
};

export const extractTextFromDocument = async (file: ImagePart, options?: { fast: boolean }): Promise<string> => {
    const prompt = "Extract all the text from this document. Preserve the original formatting, including headings, lists, and paragraphs, as much as possible using markdown.";
    const response = await ai.models.generateContent({
        model: options?.fast ? 'gemini-2.5-flash' : 'gemini-2.5-pro',
        contents: { parts: [{ text: prompt }, file] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim();
};

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

    let systemInstruction = `You are Blay, a helpful AI academic assistant. The user has uploaded a document about "${context}". Answer their questions based on this document.`;
    if (smartPlan) {
        systemInstruction += ` You also have access to the user's study plan: ${JSON.stringify(smartPlan)}. You can use this to answer questions about their schedule.`;
    }
    
    const contents: any = [...chatHistory];
    const userParts: ({ text: string } | ImagePart)[] = [{ text: userMessage }];
    if (file) {
        userParts.push(file);
    }
    contents.push({ role: 'user', parts: userParts });

    const response = await ai.models.generateContentStream({
        model: "gemini-2.5-pro",
        contents: contents,
        config: {
            systemInstruction,
            safetySettings,
        },
    });

    return response;
};


export const generateQuiz = async (
    context: string,
    numQuestions: number,
    quizType: QuizType,
    focusArea: string
): Promise<QuizQuestion[]> => {
    const prompt = `
        Based on the provided text, generate a quiz.
        Context: ${context}
        Number of Questions: ${numQuestions}
        Quiz Type: ${quizType}
        ${focusArea ? `Focus specifically on: ${focusArea}` : ''}

        The output must be a JSON array of QuizQuestion objects matching the provided schema.
        A QuizQuestion is { question: string; options?: string[]; correctAnswer: string; explanation: string; topic: string; type: QuizType }.
        - For 'Multiple Choice' questions, provide an 'options' array of 4 strings.
        - 'correctAnswer' must exactly match one of the options for MCQ.
        - 'explanation' should clarify why the correct answer is right.
        - 'topic' should be a short phrase identifying the question's subject.
        - Ensure questions and answers are formatted with markdown where appropriate (e.g., for code or formulas).
        - Do NOT include any markdown or commentary outside of the JSON.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: quizSchema,
            safetySettings 
        },
    });
    return parseGeminiResponse<QuizQuestion[]>(response);
};


export const isImageAProblem = async (image: ImagePart): Promise<boolean> => {
    const prompt = "Does this image contain an academic problem, equation, or question (e.g., from a textbook, exam paper, or whiteboard)? Respond with only 'true' or 'false'.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, image] },
        config: {
            safetySettings,
        },
    });
    return response.text.trim().toLowerCase() === 'true';
};

export const solveProblem = async (
    questionText: string,
    imagePart: ImagePart | null,
    outputFormat: string,
    programmingLanguage: string,
    graphInterval?: string,
    graphYInterval?: string,
): Promise<string> => {
    let prompt = `Solve the following academic problem.
    
    Problem: ${questionText}
    
    Provide the solution in the following format: ${outputFormat}.
    `;

    if (outputFormat === 'code') {
        prompt += ` Use the programming language: ${programmingLanguage}. Only output the code itself inside a markdown block.`;
    } else if (outputFormat === 'graph') {
        prompt += ` Provide a JSON object matching the provided schema with 'explanation', 'graphFunction' (a string like "2*x**2 + 3*x - 5"), and an optional 'suggestedTitle'.
        ${graphInterval ? `The user suggests an x-axis interval of ${graphInterval}.` : ''}
        ${graphYInterval ? `The user suggests a y-axis interval of ${graphYInterval}.` : ''}
        Do NOT include any markdown or commentary outside the JSON object.
        `;
    } else {
        prompt += ` Format the response clearly using markdown, including LaTeX for equations where appropriate.`;
    }
    
    const contents: any = { parts: [{ text: prompt }] };
    if (imagePart) {
        contents.parts.push(imagePart);
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents,
        config: {
            ...(outputFormat === 'graph' ? { 
                responseMimeType: 'application/json',
                responseSchema: graphSolutionSchema
            } : {}),
            safetySettings,
        },
    });
    return response.text.trim();
};