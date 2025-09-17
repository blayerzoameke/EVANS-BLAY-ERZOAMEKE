
import React, { useState, useEffect, useCallback } from 'react';
import UserDetailsForm from './UserDetailsForm';
import TimetableInput from './TimetableInput';
import SmartPlanView from './SmartPlanView';
import { generateSmartPlan, generatePlanFromImage } from '../services/geminiService';
// FIX: Added StoredPlan to type imports for props definition. Removed unused DayOfWeek.
import type { UserDetails, Lecture, StudyGoal, AgendaItem, BreakPreference, SmartPlan, StoredPlan, ImagePart } from '../types';
import { UploadIcon } from './icons/UploadIcon';

const emptyUserDetails: UserDetails = { name: '', educationalLevel: 'Undergraduate', institution: '', country: '' };

// FIX: Updated props to include savedTimetables and setSavedTimetables, and corrected setSmartPlan to accept null.
const Dashboard: React.FC<{
  setSmartPlan: (plan: SmartPlan | null) => void;
  smartPlan: SmartPlan | null;
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
  savedTimetables: StoredPlan[];
  setSavedTimetables: (plans: StoredPlan[]) => void;
}> = ({ setSmartPlan, smartPlan, userDetails: initialUserDetails, setUserDetails: setGlobalUserDetails }) => {
  const [userDetails, setUserDetails] = useState<UserDetails>(initialUserDetails || emptyUserDetails);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [breakPreferences, setBreakPreferences] = useState<BreakPreference[]>([]);
  const [generalGoals, setGeneralGoals] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (initialUserDetails) {
      setUserDetails(initialUserDetails);
    }
  }, [initialUserDetails]);

  const handleUserDetailsChange = useCallback((details: UserDetails) => {
    setUserDetails(details);
    setGlobalUserDetails(details);
  }, [setGlobalUserDetails]);

  const handleGeneratePlan = async () => {
    if (!userDetails.name || !userDetails.educationalLevel) {
      setError("Please fill in your name and educational level.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let plan;
      if (imageFile) {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          const imagePart: ImagePart = {
            inlineData: { data: base64String, mimeType: imageFile.type }
          };
          plan = await generatePlanFromImage(userDetails, studyGoals, breakPreferences, generalGoals, imagePart);
          setSmartPlan(plan);
          setIsLoading(false);
        };
      } else {
        plan = await generateSmartPlan(userDetails, lectures, studyGoals, agendaItems, breakPreferences, generalGoals);
        setSmartPlan(plan);
        setIsLoading(false);
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      // Clear manual inputs if image is uploaded
      setLectures([]);
      setAgendaItems([]);
    }
  };
  
  const clearImage = () => {
      setImageFile(null);
      setImagePreview(null);
  }

  return (
    <div className="space-y-8">
      {!smartPlan ? (
        <>
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-10">
            <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-2">Create Your Smart Plan</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Fill in your details, and let AI craft the perfect schedule for you.</p>

            <div className="space-y-6">
              <section>
                <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">1. Your Details</h3>
                <UserDetailsForm userDetails={userDetails} setUserDetails={handleUserDetailsChange} disabled={isLoading} />
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">2. Your Schedule</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">You can either upload an image of your existing timetable or enter your fixed items manually below.</p>
                <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
                  {!imagePreview ? (
                    <>
                      <label htmlFor="timetable-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                        <UploadIcon className="w-5 h-5" />
                        Upload Timetable Image
                      </label>
                      <input id="timetable-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isLoading} />
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                        <img src={imagePreview} alt="Timetable preview" className="max-h-48 rounded-md" />
                        <button onClick={clearImage} className="text-sm text-red-500 hover:underline" disabled={isLoading}>Remove Image</button>
                    </div>
                  )}
                </div>
              </section>

              {!imageFile && (
                <section>
                   <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Or, Enter Manually:</h3>
                   <TimetableInput
                    lectures={lectures} setLectures={setLectures}
                    studyGoals={studyGoals} setStudyGoals={setStudyGoals}
                    agendaItems={agendaItems} setAgendaItems={setAgendaItems}
                    breakPreferences={breakPreferences} setBreakPreferences={setBreakPreferences}
                    generalGoals={generalGoals} setGeneralGoals={setGeneralGoals}
                    disabled={isLoading}
                  />
                </section>
              )}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={handleGeneratePlan}
                disabled={isLoading}
                className="w-full md:w-auto px-8 py-3 text-lg font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Generating...' : 'Generate My Smart Plan'}
              </button>
              {error && <p className="mt-4 text-red-500">{error}</p>}
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Your Smart Plan</h2>
            <button
              onClick={() => setSmartPlan(null)}
              className="px-4 py-2 font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900"
            >
              Create New Plan
            </button>
          </div>
          <SmartPlanView 
            plan={smartPlan} 
            institution={userDetails.institution}
            institutionLogo={userDetails.institutionLogo}
           />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
