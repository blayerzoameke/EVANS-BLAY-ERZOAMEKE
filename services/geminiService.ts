

// FIX: Corrected import from GoogleGenerativeAI to GoogleGenAI as per Gemini API guidelines.
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type {
  UserDetails,
  Lecture,
  StudyGoal,
  AgendaItem,
  SmartPlan,
  ImagePart,
  QuizQuestion,
  QuizType,
  ChatTurn,
  DayOfWeek,
} from "../types.ts";
import { DayOfWeek as DayOfWeekEnum } from "../types.ts";

// Always use new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const textModel = "gemini-2.5-flash";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const generateContent = async (prompt: string | (string | ImagePart)[], responseSchema?: any, options?: { fast?: boolean }) => {
  try {
    const config: any = {
        safetySettings,
        temperature: 0.5,
    };
    if (responseSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = responseSchema;
    }

    if (options?.fast) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }

    let contents;
    if (Array.isArray(prompt)) {
        const parts = prompt.map(p => {
            if (typeof p === 'string') {
                return { text: p };
            }
            return p; // It's already an ImagePart, which is a valid Part.
        });
        // For a single-turn multimodal prompt, the `contents` field expects a single `Content` object.
        contents = { parts };
    } else {
        // For a simple text prompt, a string is acceptable.
        contents = prompt;
    }

    const result = await ai.models.generateContent({
        model: textModel,
        contents,
        config,
    });
    
    const text = result.text;
    
    if (responseSchema) {
      // The response text can sometimes be wrapped in markdown or have extra text.
      // This is a more robust way to extract the JSON string.
      let jsonStr = text.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
      }
      const firstBracket = jsonStr.indexOf('[');
      const firstBrace = jsonStr.indexOf('{');
      
      let startIndex = -1;
      
      if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
          startIndex = firstBracket;
      } else if (firstBrace !== -1) {
          startIndex = firstBrace;
      }
      
      if (startIndex !== -1) {
          const jsonType = jsonStr[startIndex];
          const endChar = jsonType === '[' ? ']' : '}';
          const endIndex = jsonStr.lastIndexOf(endChar);
          if (endIndex > startIndex) {
              jsonStr = jsonStr.substring(startIndex, endIndex + 1);
          }
      }

      try {
        return JSON.parse(jsonStr);
      } catch (e: any) {
        console.error("Failed to parse AI response as JSON:", e.message);
        console.error("Attempted to parse this string:", jsonStr);
        console.error("Original text from model:", text);
        throw new Error("The AI returned data in an invalid format. Please try generating again.");
      }
    }
    return text;
  } catch (error) {
    console.error("Gemini API call failed:", error);
    if (error instanceof Error && error.message.includes("invalid format")) {
        throw error;
    }
    throw new Error("Failed to get a response from the AI model. It might be a network issue or an internal error.");
  }
};

// Function implementations

export const generateSmartPlan = async (
  userDetails: UserDetails,
  lectures: Lecture[],
  studyGoals: StudyGoal[],
  agendaItems: AgendaItem[],
  generalGoals: string,
  existingPlan?: SmartPlan
): Promise<SmartPlan> => {
  const prompt = `
    Create a smart weekly timetable for a student with the following details:
    - Name: ${userDetails.name}
    - Educational Level: ${userDetails.educationalLevel}
    - Institution: ${userDetails.institution || 'Not specified'}
    - Programme of Study: ${userDetails.programmeOfStudy || 'Not specified'}

    Their schedule and goals are as follows:
    - Lectures: ${JSON.stringify(lectures)}
    - Weekly Study Goals: ${JSON.stringify(studyGoals)}
    - Personal Agenda Items: ${JSON.stringify(agendaItems)}
    - General Goals/Preferences: ${generalGoals || 'Balance study with personal time.'}

    ${existingPlan ? `This is a request to regenerate an existing plan. Here is the current plan for reference: ${JSON.stringify(existingPlan)}. Please make adjustments based on the general goals/preferences provided.` : ''}

    Rules for timetable generation:
    1.  Schedule all lectures and agenda items at their specified times. These are fixed.
    2.  Allocate study sessions to meet the weekly study goals for each subject. Spread them out.
    3.  Incorporate short breaks (15-30 mins) after study sessions and longer breaks (1-2 hours) for meals.
    4.  Fill remaining time with 'Free Time'.
    5.  The output must be a valid JSON array of DayPlan objects. CRITICAL: Ensure that any double quotes inside of string values are properly escaped with a backslash (e.g., \\"). Do not include any other text or markdown.
    6.  The structure for each slot in a day's 'slots' array should be: { activity: string, startTime: string, endTime: string, type: 'lecture' | 'study' | 'agenda' | 'break' | 'free' }.
    7.  Times should be in "HH:MM AM/PM" format.
  `;
  
  const schema = {
      type: Type.ARRAY,
      items: {
          type: Type.OBJECT,
          properties: {
              day: { type: Type.STRING },
              slots: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          activity: { type: Type.STRING },
                          startTime: { type: Type.STRING },
                          endTime: { type: Type.STRING },
                          type: { type: Type.STRING },
                          isLocked: { type: Type.BOOLEAN, nullable: true },
                          code: { type: Type.STRING, nullable: true },
                          link: { type: Type.STRING, nullable: true }
                      },
                      required: ['activity', 'startTime', 'endTime', 'type']
                  }
              }
          },
          required: ['day', 'slots']
      }
  };

  return generateContent(prompt, schema);
};

export const generatePlanFromImage = async (
  userDetails: UserDetails,
  studyGoals: StudyGoal[],
  generalGoals: string,
  imagePart: ImagePart,
  existingPlan?: SmartPlan
): Promise<SmartPlan | { error: string }> => {
  const prompt = `
    Analyze the provided timetable image and create a smart weekly study plan based on it.
    Student Details:
    - Name: ${userDetails.name}
    - Educational Level: ${userDetails.educationalLevel}
    - Weekly Study Goals: ${JSON.stringify(studyGoals)}
    - General Goals/Preferences: ${generalGoals || 'Balance study with personal time.'}

    ${existingPlan ? `This is a request to regenerate an existing plan. Here is the current plan for reference: ${JSON.stringify(existingPlan)}. Please make adjustments based on the general goals/preferences provided, considering the image as the base timetable.` : ''}

    Instructions:
    1.  Extract all fixed events (lectures, labs) from the image. These should be of type 'lecture' and marked as 'isLocked: true'.
    2.  Incorporate the student's weekly study goals by scheduling 'study' sessions.
    3.  Add reasonable breaks and free time.
    4.  The output must be a valid JSON array of DayPlan objects. CRITICAL: Ensure that any double quotes inside of string values are properly escaped with a backslash (e.g., \\").
    5.  The structure for each slot in a day's 'slots' array should be: { activity: string, startTime: string, endTime: string, type: 'lecture' | 'study' | 'agenda' | 'break' | 'free', isLocked?: boolean, code?: string }.
  `;
  
  const schema = {
      type: Type.ARRAY,
      items: {
          type: Type.OBJECT,
          properties: {
              day: { type: Type.STRING },
              slots: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          activity: { type: Type.STRING },
                          startTime: { type: Type.STRING },
                          endTime: { type: Type.STRING },
                          type: { type: Type.STRING },
                          isLocked: { type: Type.BOOLEAN, nullable: true },
                          code: { type: Type.STRING, nullable: true },
// FIX: Corrected schema type from "string" to Type.STRING.
                          link: { type: Type.STRING, nullable: true }
                      },
                      required: ['activity', 'startTime', 'endTime', 'type']
                  }
              }
          },
          required: ['day', 'slots']
      }
  };

  return generateContent([prompt, imagePart], schema);
};

export const isImageTimetable = async (imagePart: ImagePart): Promise<boolean> => {
  const prompt = "Does this image appear to be a school or university timetable? Respond with only 'true' or 'false'.";
  const result = await generateContent([prompt, imagePart], undefined, { fast: true });
  return result.toLowerCase().includes('true');
};


export const getDocumentContext = async (filePart: ImagePart): Promise<string> => {
  const prompt = "Based on the content of this document/image, what is the primary subject or topic? Be concise, one or two words is best (e.g., 'Calculus', 'World History').";
  return generateContent([prompt, filePart], undefined, { fast: true });
};

export const isStudyMaterial = async (filePart: ImagePart): Promise<boolean> => {
    const prompt = "Does this document/image contain educational content or study material? Answer with only 'true' or 'false'.";
    const result = await generateContent([prompt, filePart], undefined, { fast: true });
    return result.toLowerCase().includes('true');
};

export const summarizeDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = `Provide a concise summary of this document about ${context}. Focus on the key concepts, main arguments, and important definitions. Use markdown for formatting, including headers and lists.`;
    return generateContent([prompt, filePart]);
};

export const explainDocument = async (filePart: ImagePart, context: string): Promise<string> => {
    const prompt = `Explain the most complex or important topics in this document about ${context} in a clear and simple way. Use analogies and examples where possible. Use markdown for formatting.`;
    return generateContent([prompt, filePart]);
};

export const extractTextFromDocument = async (filePart: ImagePart): Promise<string> => {
    const prompt = "Extract all text from this document/image. Preserve formatting as much as possible.";
    return generateContent([prompt, filePart], undefined, { fast: true });
};

export const chatWithDocumentStream = async (
    filePart: ImagePart, 
    userMessage: string, 
    history: ChatTurn[], 
    context: string,
    smartPlan: SmartPlan | null
) => {
    let systemInstruction = `You are a helpful study assistant named Blay. Your primary knowledge is based on the provided document about ${context}. Answer the user's questions based ONLY on the document's content. Do not use external knowledge. CRITICAL RULE: If the user asks you to quiz them, create a test, or generate questions, you MUST NOT create a quiz. Instead, you must politely tell them to go to the 'Exam Prep' section of the app to generate quizzes.`;

    if (smartPlan) {
        const DAYS_MAP: DayOfWeek[] = [DayOfWeekEnum.Sunday, DayOfWeekEnum.Monday, DayOfWeekEnum.Tuesday, DayOfWeekEnum.Wednesday, DayOfWeekEnum.Thursday, DayOfWeekEnum.Friday, DayOfWeekEnum.Saturday];
        const today = DAYS_MAP[new Date().getDay()];
        const todayPlan = smartPlan.find(day => day.day === today);

        if (todayPlan && todayPlan.slots.length > 0) {
            const relevantSlots = todayPlan.slots.map(s => ({ activity: s.activity, type: s.type, startTime: s.startTime, endTime: s.endTime }));
            systemInstruction += ` You also have access to the user's schedule for today to answer questions about their timetable. Today's schedule is: ${JSON.stringify(relevantSlots)}.`;
        }
    }
    
    systemInstruction += " If the answer is not in the document or the provided schedule, say so.";
    
    // The 'history' parameter should contain all complete, previous turns.
    const chatHistory = history.flatMap(turn => [{ role: 'user', parts: [{ text: turn.user }] }, { role: 'model', parts: [{ text: turn.blay }] }]);

    // The document (filePart) should only be sent with the latest user message.
    const contents = [
        ...chatHistory,
        { role: 'user', parts: [filePart, { text: userMessage }] }
    ];

    const result = await ai.models.generateContentStream({
        model: textModel,
        contents: contents as any,
        config: {
            systemInstruction,
            safetySettings,
            temperature: 0.7,
        }
    });

    return result;
};

export const generateQuiz = async (
    content: string,
    numQuestions: number,
    quizType: QuizType,
    focusArea: string
): Promise<QuizQuestion[]> => {
    const prompt = `
        Based on the following study material, generate a quiz.
        
        Quiz Parameters:
        - Number of Questions: ${numQuestions}
        - Question Type: ${quizType}
        - Focus Area: ${focusArea || 'General content'}

        Study Material:
        ---
        ${content}
        ---

        Instructions:
        1.  Create ${numQuestions} questions of the type '${quizType}'.
        2.  If the type is 'Multiple Choice', provide 4 options, with one being correct.
        3.  For all question types, provide a correct answer and a brief explanation.
        4.  Identify the specific topic within the material for each question.
        5.  The output must be a valid JSON array of QuizQuestion objects. CRITICAL: Ensure that any double quotes inside of string values (like in the 'explanation' field) are properly escaped with a backslash (e.g., \\"). The response should only contain the JSON array, with no surrounding text or markdown.
    `;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                topic: { type: Type.STRING },
                type: { type: Type.STRING }
            },
            required: ['question', 'correctAnswer', 'explanation', 'topic', 'type']
        }
    };
    
    return generateContent(prompt, schema);
};

export const solveProblem = async (
  questionText: string,
  imagePart: ImagePart | null,
  outputFormat: 'steps' | 'latex' | 'code' | 'graph',
  programmingLanguage: string,
  graphInterval: string
): Promise<string> => {
    const promptParts: (string | ImagePart)[] = [];
    let promptText = `Solve the following problem.
Problem: ${questionText}
    
Output Format requirements: ${outputFormat}.
    `;
    
    if(outputFormat === 'code') {
        promptText += `\nProvide the code in ${programmingLanguage}.`;
    }

    if (outputFormat === 'graph') {
        promptText += `\nYour task is to solve the problem and provide the necessary information to plot a graph of the solution.
    1. Provide a step-by-step explanation for the solution.
    2. Identify the mathematical function that needs to be plotted.
    3. The user has provided graph settings: ${graphInterval || 'auto'}. Use this to inform your response if relevant.

    Your output MUST be a valid JSON object with the following structure:
    - "explanation": A string containing the step-by-step solution.
    - "graphFunction": A string containing only the mathematical expression to be plotted (e.g., "x**2 * sin(x)"). Use standard mathematical notation.
    - "suggestedTitle": An optional string for the graph's title.
    
    CRITICAL: The JSON object should be the only thing in your response. Do not wrap it in markdown. Do not add any text before or after the JSON.`;

        promptParts.push(promptText);

        if (imagePart) {
            promptParts.push(imagePart);
        }

        const schema = {
            type: Type.OBJECT,
            properties: {
                explanation: { type: Type.STRING },
                graphFunction: { type: Type.STRING },
                suggestedTitle: { type: Type.STRING, nullable: true },
            },
            required: ['explanation', 'graphFunction']
        };
        
        const result = await generateContent(promptParts, schema);
        return JSON.stringify(result);
    }
    
    promptParts.push(promptText);

    if (imagePart) {
        promptParts.push(imagePart);
    }
    
    return generateContent(promptParts);
};

export const isImageAProblem = async (imagePart: ImagePart): Promise<boolean> => {
    const prompt = "Does this image contain an academic problem, equation, or question (e.g., math, physics, chemistry)? Answer with only 'true' or 'false'.";
    const result = await generateContent([prompt, imagePart], undefined, { fast: true });
    return result.toLowerCase().includes('true');
};