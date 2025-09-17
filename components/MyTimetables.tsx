import React, { useState, useEffect } from 'react';
import type { StoredPlan, SmartPlan } from '../types';
import SmartPlanView from './SmartPlanView';
import { StarIcon } from './icons/StarIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CloseIcon } from './icons/CloseIcon';

interface MyTimetablesProps {
  savedTimetables: StoredPlan[];
  setSavedTimetables: (plans: StoredPlan[]) => void;
  onLoadPlan: (plan: SmartPlan) => void;
}

const MyTimetables: React.FC<MyTimetablesProps> = ({ savedTimetables, setSavedTimetables, onLoadPlan }) => {
  const [modal, setModal] = useState<'view' | 'rename' | 'delete' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<StoredPlan | null>(null);
  const [newName, setNewName] = useState('');

  const sortedPlans = [...savedTimetables].sort((a, b) => (b.isFavourite ? 1 : 0) - (a.isFavourite ? 1 : 0));

  const openModal = (type: 'view' | 'rename' | 'delete', plan: StoredPlan) => {
    setSelectedPlan(plan);
    setModal(type);
    if (type === 'rename') {
      setNewName(plan.name);
    }
  };

  const closeModal = () => {
    setModal(null);
    setSelectedPlan(null);
    setNewName('');
  };

  const handleRename = () => {
    if (selectedPlan && newName) {
      const updatedPlans = savedTimetables.map(p => p.id === selectedPlan.id ? { ...p, name: newName } : p);
      setSavedTimetables(updatedPlans);
    }
    closeModal();
  };
  
  const handleDelete = () => {
    if (selectedPlan) {
        const updatedPlans = savedTimetables.filter(p => p.id !== selectedPlan.id);
        setSavedTimetables(updatedPlans);
    }
    closeModal();
  };

  const toggleFavourite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedPlans = savedTimetables.map(p => p.id === id ? { ...p, isFavourite: !p.isFavourite } : p);
    setSavedTimetables(updatedPlans);
  };


  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">My Timetables</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your saved Smart Plans.</p>
      </div>
      
      <div className="space-y-6">
        {sortedPlans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPlans.map((p) => (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 flex flex-col justify-between transition-transform hover:scale-105" onClick={() => openModal('view', p)}>
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">{p.name}</p>
                    <button onClick={(e) => toggleFavourite(p.id, e)} className={`p-1 rounded-full ${p.isFavourite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}>
                        <StarIcon className={`w-5 h-5 ${p.isFavourite ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Saved on: {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                  <button onClick={(e) => {e.stopPropagation(); onLoadPlan(p.plan); alert('Plan loaded onto dashboard!')}} className="flex-1 px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Load</button>
                  <button onClick={(e) => {e.stopPropagation(); openModal('rename', p)}} className="flex-1 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Rename</button>
                  <button onClick={(e) => {e.stopPropagation(); openModal('delete', p)}} className="flex-1 px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-16 bg-white dark:bg-gray-800 rounded-lg">You have no saved plans yet. Generate a plan on the dashboard to save it here.</p>
        )}
      </div>

      {/* Modals */}
      {modal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h3 className="text-xl font-bold">{modal === 'view' ? selectedPlan.name : `${modal.charAt(0).toUpperCase() + modal.slice(1)} Plan`}</h3>
                <button onClick={closeModal}><CloseIcon className="w-6 h-6" /></button>
             </div>
             <div className="p-6 overflow-y-auto">
                {modal === 'view' && <SmartPlanView plan={selectedPlan.plan} />}
                {modal === 'rename' && (
                    <div className="space-y-4">
                        <label>New name for "{selectedPlan.name}"</label>
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700" />
                        <button onClick={handleRename} className="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Save</button>
                    </div>
                )}
                 {modal === 'delete' && (
                    <div className="space-y-4 text-center">
                        <p>Are you sure you want to delete the plan "{selectedPlan.name}"?</p>
                        <p className="text-sm text-red-500">This action cannot be undone.</p>
                        <div className="flex justify-center gap-4 pt-4">
                            <button onClick={closeModal} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Cancel</button>
                            <button onClick={handleDelete} className="px-6 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTimetables;
