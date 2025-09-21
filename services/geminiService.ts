// FIX: Implement full Gemini service functionality.
import { GoogleGenAI, Type } from "@google/genai";
import type {
    UserDetails,
    Lecture,
    StudyGoal,
    AgendaItem,
    SmartPlan,
    ImagePart,
    ChatTurn,
    QuizQuestion,
    QuizType,
} from '../types.ts';
import { ActivityType, DayOfWeek } from '../types.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const smartPlanSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      day: { type: Type.STRING, enum: Object.values(DayOfWeek) },
      slots: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            activity: { type: Type.STRING },
            startTime: { type: Type.STRING },
            endTime: { type: Type.STRING },
            type: { type: Type.STRING, enum: Object.values(ActivityType) },
            link: { type: Type.STRING },
            code: { type: Type.STRING },
          },
          required: ['activity', 'startTime', 'endTime', 'type'],
        },
      },
    },
    required: ['day', 'slots'],
  },
};

const quizSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            topic: { type: Type.STRING },
            type: { type: Type.STRING } // Cannot use enum from types.ts here directly
        },
        required: ['question', 'correctAnswer', 'explanation', 'topic', 'type']
    }
};

const buildPrompt = (
  userDetails: UserDetails,
  lectures: Lecture[],
  studyGoals: StudyGoal[],
  agendaItems: AgendaItem[],
  generalGoals: string
): string => {
  let prompt = `Create a smart study plan for a student with these details:\n`;
  prompt += `- Name: ${userDetails.name}\n`;
  prompt += `- Educational Level: ${userDetails.educationalLevel}\n`;
  if (userDetails.institution) prompt += `- Institution: ${userDetails.institution}\n`;

  prompt += `\nSCHEDULE:\n`;
  if (lectures.length > 0) {
    prompt += `Lectures:\n${lectures.map(l => `- ${l.subject} on ${l.day} from ${l.startTime} to ${l.endTime}`).join('\n')}\n`;
  }
  if (agendaItems.length > 0) {
    prompt += `Other Agenda Items:\n${agendaItems.map(i => `- ${i.title} on ${i.day} from ${i.startTime} to ${i.endTime}`).join('\n')}\n`;
  }

  prompt += `\nGOALS:\n`;
  if (studyGoals.length > 0) {
    prompt += `Study Goals:\n${studyGoals.map(g => `- Study ${g.subject} for ${g.hours} hours per week.`).join('\n')}\n`;
  }
  if (generalGoals) {
    prompt += `General Goals: ${generalGoals}\n`;
  }

  prompt += `\nINSTRUCTIONS:\n`;
  prompt += `- Generate a balanced weekly schedule in JSON format according to the provided schema.\n`;
  prompt += `- Fill the schedule with lectures, dedicated study slots for each subject, personal agenda items, and reasonable breaks.\n`;
  prompt += `- Ensure study slots meet the hourly goals per subject.\n`;
  prompt += `- Label free time appropriately as 'Free Time'.\n`;
  prompt += `- Use HH:MM AM/PM format for times (e.g., 09:00 AM, 01:30 PM).\n`;
  prompt += `- Respond ONLY with the JSON object.`;

  return prompt;
};

export const generateSmartPlan = async (
    userDetails: UserDetails,
    lectures: Lecture[],
    studyGoals: StudyGoal[],
    agendaItems: AgendaItem[],
    generalGoals: string
): Promise<SmartPlan> => {
    const prompt = buildPrompt(userDetails, lectures, studyGoals, agendaItems, generalGoals);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: smartPlanSchema
            }
        });
        return JSON.parse(response.text);
    } catch (error: any) {
        console.error("Error generating smart plan:", error);
        throw new Error("Failed to generate the smart plan. The model might be temporarily unavailable.");
    }
};

export const generatePlanFromImage = async (
    userDetails: UserDetails,
    studyGoals: StudyGoal[],
    generalGoals: string,
    imagePart: ImagePart
): Promise<SmartPlan> => {
    let prompt = `Analyze the provided timetable image and create a smart study plan for a student with these details:\n`;
    prompt += `- Name: ${userDetails.name}\n`;
    prompt += `- Educational Level: ${userDetails.educationalLevel}\n`;
    if (studyGoals.length > 0) {
      prompt += `Study Goals:\n${studyGoals.map(g => `- Study ${g.subject} for ${g.hours} hours per week.`).join('\n')}\n`;
    }
    if (generalGoals) {
      prompt += `General Goals: ${generalGoals}\n`;
    }
    prompt += `\nINSTRUCTIONS:\n`;
    prompt += `- First, extract all scheduled items from the image.\n`;
    prompt += `- Then, generate a balanced weekly schedule in JSON format according to the provided schema.\n`;
    prompt += `- Incorporate the items from the image, add dedicated study slots to meet the goals, and include reasonable breaks.\n`;
    prompt += `- Respond ONLY with the JSON object.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, imagePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: smartPlanSchema
            }
        });
        return JSON.parse(response.text);
    } catch (error: any) {
        console.error("Error generating plan from image:", error);
        throw new Error("Failed to generate plan from image. Please ensure the image is clear.");
    }
};

export const isImageTimetable = async (imagePart: ImagePart): Promise<boolean> => {
    const prompt = "Does this image appear to be a student's class schedule or timetable? Answer with a single word: 'yes' or 'no'.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, imagePart] }
    });
    return response.text.toLowerCase().includes('yes');
};

export const isStudyMaterial = async (filePart: ImagePart): Promise<boolean> => {
    const prompt = `Is this document a slide, lecture note, textbook page, or other academic study material? Answer with a single word: 'yes' or 'no'.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, filePart] }
    });
    return response.text.toLowerCase().includes('yes');
};

export const getDocumentContext = async (filePart: ImagePart): Promise<string> => {
    const prompt = `What is the main academic subject of this document (e.g., "Quantum Physics", "Organic Chemistry", "Shakespearean Literature")? Provide a concise, one-to-three word answer.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, filePart] }
    });
    return response.text.trim();
};

export const summarizeDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = `Provide a detailed yet concise summary of this document on ${context}. Focus on the key concepts, definitions, and main takeaways. Format the output with markdown (e.g., headings, bold text, lists).`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, filePart] }
    });
    return response.text;
};

export const explainDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = `Explain the core concepts in this document on ${context} as if you were teaching it to a university student. Break down complex ideas into simpler terms, provide analogies, and explain the significance of the key points. Format the output with markdown. If there are mathematical formulas or graphs, represent them using LaTeX (inline with $...$ and display with $$...$$) or a JSON object for graphs like {"graph": {"function": "x^2", "domain": [-5, 5]}}.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, filePart] }
    });
    return response.text;
};

export const extractTextFromDocument = async (filePart: ImagePart): Promise<string> => {
    const prompt = "Extract all text from this document. Preserve the original formatting and line breaks as much as possible.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, filePart] }
    });
    return response.text;
};

export const chatWithDocumentStream = async (filePart: ImagePart, question: string, history: ChatTurn[], context: string) => {
    const formattedHistory = history.map(turn => `User: ${turn.user}\nAI: ${turn.blay}`).join('\n');
    const prompt = `You are a helpful study assistant. The user has uploaded a document about ${context}. Here is the chat history so far:\n${formattedHistory}\n\nBased on the document provided, answer the following user question: "${question}". If the document doesn't contain the answer, say so.`;
    
    return await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, filePart] }
    });
};

export const generateQuiz = async (topic: string, numQuestions: number, quizType: QuizType): Promise<QuizQuestion[]> => {
    const prompt = `Generate a quiz with ${numQuestions} questions on the topic of "${topic}". The quiz type should be "${quizType}". For each question, provide the question text, options (for Multiple Choice), the correct answer, a detailed explanation, the specific topic, and the question type. Respond ONLY with the JSON object matching the provided schema.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate quiz. The model might be temporarily unavailable or the topic is too niche.");
    }
};