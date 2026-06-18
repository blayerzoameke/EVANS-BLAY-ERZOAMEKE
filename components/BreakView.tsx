
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ActiveSession } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { notificationService } from '../services/notificationService';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { PlayIcon } from './icons/PlayIcon';

interface BreakViewProps {
    session: ActiveSession;
    onEnd: (skipped: boolean) => void;
}

// PREMIUM Walking Animation with 3D depth
const WalkingPersonAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-end justify-center overflow-hidden">
        {/* Sky with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 dark:from-blue-900 dark:via-blue-800 dark:to-blue-700">
            {/* Sun with glow */}
            <div className="absolute top-10 right-20 w-20 h-20">
                <div className="absolute inset-0 bg-yellow-300 rounded-full blur-xl animate-pulse opacity-60"></div>
                <div className="absolute inset-2 bg-yellow-400 rounded-full shadow-2xl"></div>
            </div>
            
            {/* Realistic clouds with shadows */}
            <div className="absolute top-16 left-16 animate-float-slow">
                <div className="relative">
                    <div className="w-32 h-14 bg-white rounded-full blur-sm opacity-80"></div>
                    <div className="absolute top-2 left-8 w-24 h-12 bg-white rounded-full blur-sm opacity-90"></div>
                    <div className="absolute top-3 left-16 w-20 h-10 bg-white rounded-full blur-sm"></div>
                </div>
            </div>
            <div className="absolute top-24 right-24 animate-float-slower">
                <div className="relative">
                    <div className="w-40 h-16 bg-white rounded-full blur-sm opacity-70"></div>
                    <div className="absolute top-3 left-10 w-28 h-14 bg-white rounded-full blur-sm opacity-80"></div>
                </div>
            </div>
        </div>

        {/* Mountains in background */}
        <div className="absolute bottom-32 left-0 right-0">
            <div className="relative h-32">
                <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-green-700 to-green-500 opacity-40 clip-mountain"></div>
            </div>
        </div>

        {/* Trees for depth */}
        <div className="absolute bottom-24 left-12 w-8 h-16 bg-gradient-to-b from-green-700 to-green-900 rounded-t-full opacity-60"></div>
        <div className="absolute bottom-24 right-16 w-10 h-20 bg-gradient-to-b from-green-700 to-green-900 rounded-t-full opacity-60"></div>

        {/* Ground with texture */}
        <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-green-700 via-green-600 to-green-500 dark:from-green-900 dark:via-green-800 dark:to-green-700">
            {/* Grass texture overlay */}
            <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
            }}></div>
        </div>

        {/* Path with perspective */}
        <div className="absolute bottom-0 left-1/4 right-1/4 h-24 bg-gradient-to-b from-yellow-300 to-yellow-400 opacity-50 rounded-t-full transform scale-y-75"></div>

        {/* Walking Person - More realistic proportions */}
        <div className="relative z-10 mb-8 animate-walk-side-to-side" style={{ animationDuration: '10s' }}>
            <div className="relative" style={{ transform: 'scale(1.3)' }}>
                {/* Head with face details */}
                <div className="relative w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full mx-auto border-2 border-amber-700 shadow-xl">
                    {/* Hair */}
                    <div className="absolute -top-2 left-0 right-0 h-6 bg-gradient-to-b from-amber-800 to-amber-700 rounded-t-full"></div>
                    {/* Eyes */}
                    <div className="absolute top-5 left-3">
                        <div className="w-2 h-3 bg-white rounded-full">
                            <div className="w-1.5 h-2 bg-gray-900 rounded-full mt-0.5 ml-0.5 animate-blink-smooth"></div>
                        </div>
                    </div>
                    <div className="absolute top-5 right-3">
                        <div className="w-2 h-3 bg-white rounded-full">
                            <div className="w-1.5 h-2 bg-gray-900 rounded-full mt-0.5 ml-0.5 animate-blink-smooth"></div>
                        </div>
                    </div>
                    {/* Smile */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-6 h-2 border-b-2 border-gray-900 rounded-full"></div>
                    {/* Nose */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-1 h-2 bg-amber-700 rounded-full"></div>
                </div>
                
                {/* Neck */}
                <div className="w-6 h-3 bg-gradient-to-b from-amber-400 to-amber-500 mx-auto rounded-b-lg"></div>
                
                {/* Torso with shirt details */}
                <div className="relative w-14 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg mx-auto mt-1 border-2 border-blue-800 shadow-xl">
                    {/* Shirt collar */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-3 bg-blue-400 rounded-t-lg"></div>
                    {/* Shirt buttons */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                    <div className="absolute top-7 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                </div>
                
                {/* Arms with realistic swing */}
                <div className="absolute top-20 -left-4 w-4 h-16 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full origin-top shadow-lg animate-arm-swing-realistic" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="absolute bottom-0 w-4 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full"></div>
                </div>
                <div className="absolute top-20 -right-4 w-4 h-16 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full origin-top shadow-lg animate-arm-swing-realistic-reverse" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="absolute bottom-0 w-4 h-6 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full"></div>
                </div>
                
                {/* Legs with pants */}
                <div className="absolute bottom-0 left-3 w-4 h-18 bg-gradient-to-b from-gray-700 to-gray-900 rounded-full origin-top shadow-lg animate-leg-walk-realistic">
                    <div className="absolute bottom-0 w-5 h-4 bg-gray-800 rounded-lg shadow-md"></div>
                </div>
                <div className="absolute bottom-0 right-3 w-4 h-18 bg-gradient-to-b from-gray-700 to-gray-900 rounded-full origin-top shadow-lg animate-leg-walk-realistic-reverse">
                    <div className="absolute bottom-0 w-5 h-4 bg-gray-800 rounded-lg shadow-md"></div>
                </div>
            </div>
        </div>

        {/* Shadow under person */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-4 bg-black/20 rounded-full blur-sm animate-shadow-move"></div>

        {/* Status indicator - Z-INDEX 50 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-xl animate-bounce-subtle">🚶</span> 
                <span>Taking a refreshing walk...</span>
            </p>
        </div>

        <style>{`
            @keyframes walk-side-to-side {
                0%, 100% { transform: translateX(-40%) scale(1.2); }
                50% { transform: translateX(40%) scale(1.4); }
            }
            @keyframes arm-swing-realistic {
                0%, 100% { transform: rotate(-30deg); }
                50% { transform: rotate(30deg); }
            }
            @keyframes arm-swing-realistic-reverse {
                0%, 100% { transform: rotate(30deg); }
                50% { transform: rotate(-30deg); }
            }
            @keyframes leg-walk-realistic {
                0%, 100% { transform: rotate(-25deg); }
                50% { transform: rotate(25deg); }
            }
            @keyframes leg-walk-realistic-reverse {
                0%, 100% { transform: rotate(25deg); }
                50% { transform: rotate(-25deg); }
            }
            @keyframes float-slow {
                0%, 100% { transform: translate(0, 0); }
                50% { transform: translate(20px, -10px); }
            }
            @keyframes float-slower {
                0%, 100% { transform: translate(0, 0); }
                50% { transform: translate(-15px, -8px); }
            }
            @keyframes shadow-move {
                0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.2; }
                50% { transform: translateX(-50%) scale(0.8); opacity: 0.3; }
            }
            @keyframes blink-smooth {
                0%, 90%, 100% { transform: scaleY(1); }
                93%, 97% { transform: scaleY(0.1); }
            }
            @keyframes bounce-subtle {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-3px); }
            }
            .clip-mountain { clip-path: polygon(0 100%, 20% 40%, 40% 60%, 60% 30%, 80% 50%, 100% 100%); }
            .animate-walk-side-to-side { animation: walk-side-to-side 10s ease-in-out infinite; }
            .animate-arm-swing-realistic { animation: arm-swing-realistic 0.8s ease-in-out infinite; }
            .animate-arm-swing-realistic-reverse { animation: arm-swing-realistic-reverse 0.8s ease-in-out infinite; }
            .animate-leg-walk-realistic { animation: leg-walk-realistic 0.8s ease-in-out infinite; }
            .animate-leg-walk-realistic-reverse { animation: leg-walk-realistic-reverse 0.8s ease-in-out infinite; }
            .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
            .animate-float-slower { animation: float-slower 10s ease-in-out infinite; }
            .animate-shadow-move { animation: shadow-move 0.8s ease-in-out infinite; }
            .animate-blink-smooth { animation: blink-smooth 4s ease-in-out infinite; }
            .animate-bounce-subtle { animation: bounce-subtle 2s ease-in-out infinite; }
        `}</style>
    </div>
);

// PREMIUM Music Listening Animation
const MusicListeningAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-pink-800 to-purple-900">
        {/* Animated background waves */}
        <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-1/4 left-0 w-96 h-96 bg-pink-500 rounded-full filter blur-3xl animate-blob"></div>
                <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
            </div>
        </div>

        {/* Floating music notes */}
        <div className="absolute inset-0">
            <div className="absolute top-20 left-20 text-4xl animate-float-music opacity-60">🎵</div>
            <div className="absolute top-32 right-32 text-3xl animate-float-music-delayed opacity-70">🎶</div>
            <div className="absolute bottom-32 left-40 text-3xl animate-float-music-slow opacity-60">🎵</div>
            <div className="absolute bottom-24 right-24 text-4xl animate-float-music-delayed opacity-70">🎶</div>
            <div className="absolute top-40 left-1/2 text-2xl animate-float-music opacity-50">🎵</div>
        </div>

        {/* Sound waves emanating */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-64 h-64 border-4 border-pink-400/30 rounded-full animate-ping-slow"></div>
            <div className="absolute w-80 h-80 border-4 border-purple-400/20 rounded-full animate-ping-slower"></div>
            <div className="absolute w-96 h-96 border-4 border-blue-400/10 rounded-full animate-ping-slowest"></div>
        </div>

        {/* Person with headphones */}
        <div className="relative z-10 animate-bob-head">
            <div className="relative" style={{ transform: 'scale(1.5)' }}>
                {/* Headphones band */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-12 border-t-8 border-x-8 border-gray-800 dark:border-gray-700 rounded-t-full"></div>
                
                {/* Left headphone */}
                <div className="absolute top-0 -left-8 w-10 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 border-gray-700 shadow-2xl">
                    <div className="absolute inset-2 bg-gradient-to-br from-red-600 to-red-800 rounded-xl"></div>
                    {/* Speaker detail */}
                    <div className="absolute inset-3 bg-gray-900 rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-red-500 rounded-full"></div>
                    </div>
                </div>
                
                {/* Right headphone */}
                <div className="absolute top-0 -right-8 w-10 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 border-gray-700 shadow-2xl">
                    <div className="absolute inset-2 bg-gradient-to-br from-red-600 to-red-800 rounded-xl"></div>
                    {/* Speaker detail */}
                    <div className="absolute inset-3 bg-gray-900 rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-red-500 rounded-full"></div>
                    </div>
                </div>

                {/* Head */}
                <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full mx-auto border-2 border-amber-700 shadow-2xl">
                    {/* Hair */}
                    <div className="absolute -top-2 left-0 right-0 h-8 bg-gradient-to-b from-amber-900 to-amber-800 rounded-t-full"></div>
                    
                    {/* Closed eyes (vibing) */}
                    <div className="absolute top-6 left-3 w-3 h-2 bg-gray-900 rounded-full transform rotate-12"></div>
                    <div className="absolute top-6 right-3 w-3 h-2 bg-gray-900 rounded-full transform -rotate-12"></div>
                    
                    {/* Smile */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-7 h-3 border-b-3 border-gray-900 rounded-full"></div>
                </div>

                {/* Neck */}
                <div className="w-7 h-4 bg-gradient-to-b from-amber-500 to-amber-600 mx-auto rounded-b-lg"></div>
                
                {/* Body with music player vibes */}
                <div className="relative w-18 h-24 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl mx-auto mt-1 border-2 border-purple-900 shadow-2xl">
                    {/* Hoodie detail */}
                    <div className="absolute top-0 inset-x-2 h-4 bg-purple-700 rounded-t-lg"></div>
                    {/* Kangaroo pocket */}
                    <div className="absolute bottom-4 inset-x-3 h-6 bg-purple-900/50 rounded-lg"></div>
                </div>

                {/* Arms relaxed */}
                <div className="absolute top-24 -left-5 w-4 h-14 bg-gradient-to-b from-purple-600 to-purple-700 rounded-full shadow-lg"></div>
                <div className="absolute top-24 -right-5 w-4 h-14 bg-gradient-to-b from-purple-600 to-purple-700 rounded-full shadow-lg"></div>
            </div>
        </div>

        {/* Equalizer bars */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
            <div className="w-2 bg-pink-500 rounded-full animate-equalizer-1" style={{ height: '20px' }}></div>
            <div className="w-2 bg-purple-500 rounded-full animate-equalizer-2" style={{ height: '30px' }}></div>
            <div className="w-2 bg-blue-500 rounded-full animate-equalizer-3" style={{ height: '25px' }}></div>
            <div className="w-2 bg-pink-500 rounded-full animate-equalizer-4" style={{ height: '35px' }}></div>
            <div className="w-2 bg-purple-500 rounded-full animate-equalizer-5" style={{ height: '28px' }}></div>
            <div className="w-2 bg-blue-500 rounded-full animate-equalizer-1" style={{ height: '22px' }}></div>
        </div>

        {/* Status - Z-INDEX 50 */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 flex items-center gap-2">
                <span className="text-xl">🎧</span> 
                <span>Enjoying the music...</span>
            </p>
        </div>

        <style>{`
            @keyframes blob {
                0%, 100% { transform: translate(0, 0) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.9); }
            }
            @keyframes float-music {
                0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
                50% { transform: translateY(-30px) rotate(10deg); opacity: 0.9; }
            }
            @keyframes float-music-delayed {
                0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
                50% { transform: translateY(-40px) rotate(-10deg); opacity: 1; }
            }
            @keyframes float-music-slow {
                0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
                50% { transform: translateY(-20px) scale(1.2); opacity: 0.8; }
            }
            @keyframes bob-head {
                0%, 100% { transform: translateY(0) rotate(-2deg); }
                50% { transform: translateY(-5px) rotate(2deg); }
            }
            @keyframes ping-slow {
                0% { transform: scale(1); opacity: 0.8; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes ping-slower {
                0% { transform: scale(1); opacity: 0.6; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes ping-slowest {
                0% { transform: scale(1); opacity: 0.4; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes equalizer-1 {
                0%, 100% { height: 20px; }
                50% { height: 40px; }
            }
            @keyframes equalizer-2 {
                0%, 100% { height: 30px; }
                50% { height: 50px; }
            }
            @keyframes equalizer-3 {
                0%, 100% { height: 25px; }
                50% { height: 45px; }
            }
            @keyframes equalizer-4 {
                0%, 100% { height: 35px; }
                50% { height: 55px; }
            }
            @keyframes equalizer-5 {
                0%, 100% { height: 28px; }
                50% { height: 48px; }
            }
            .animate-blob { animation: blob 7s ease-in-out infinite; }
            .animation-delay-2000 { animation-delay: 2s; }
            .animation-delay-4000 { animation-delay: 4s; }
            .animate-float-music { animation: float-music 3s ease-in-out infinite; }
            .animate-float-music-delayed { animation: float-music-delayed 4s ease-in-out infinite 1s; }
            .animate-float-music-slow { animation: float-music-slow 5s ease-in-out infinite 0.5s; }
            .animate-bob-head { animation: bob-head 2s ease-in-out infinite; }
            .animate-ping-slow { animation: ping-slow 3s ease-out infinite; }
            .animate-ping-slower { animation: ping-slower 4s ease-out infinite 1s; }
            .animate-ping-slowest { animation: ping-slowest 5s ease-out infinite 2s; }
            .animate-equalizer-1 { animation: equalizer-1 0.6s ease-in-out infinite; }
            .animate-equalizer-2 { animation: equalizer-2 0.7s ease-in-out infinite; }
            .animate-equalizer-3 { animation: equalizer-3 0.5s ease-in-out infinite; }
            .animate-equalizer-4 { animation: equalizer-4 0.8s ease-in-out infinite; }
            .animate-equalizer-5 { animation: equalizer-5 0.6s ease-in-out infinite; }
        `}</style>
    </div>
);

// Enhanced Meditation Animation
const MeditationAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-900">
        {/* Ambient glow effects */}
        <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full filter blur-3xl animate-pulse-slow"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/30 rounded-full filter blur-2xl animate-pulse-slower"></div>
        </div>

        {/* Ripple effects */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-48 h-48 border-2 border-purple-400/20 rounded-full animate-ripple"></div>
            <div className="absolute w-64 h-64 border-2 border-pink-400/15 rounded-full animate-ripple-delayed"></div>
            <div className="absolute w-80 h-80 border-2 border-indigo-400/10 rounded-full animate-ripple-slower"></div>
        </div>

        {/* Floating lotus petals */}
        <div className="absolute top-20 left-20 text-3xl animate-float-petal opacity-40">🌸</div>
        <div className="absolute top-32 right-32 text-2xl animate-float-petal-delayed opacity-50">🌸</div>
        <div className="absolute bottom-32 left-32 text-3xl animate-float-petal-slow opacity-40">🌸</div>

        {/* Meditating person */}
        <div className="relative z-10 animate-float-gentle" style={{ transform: 'scale(1.4)' }}>
            {/* Aura glow */}
            <div className="absolute -inset-8 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 rounded-full filter blur-xl"></div>
            
            {/* Head */}
            <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full mx-auto border-2 border-amber-700 shadow-2xl">
                {/* Hair/head covering */}
                <div className="absolute -top-2 left-0 right-0 h-8 bg-gradient-to-b from-purple-900 to-purple-800 rounded-t-full"></div>
                
                {/* Peaceful closed eyes */}
                <div className="absolute top-6 left-3 w-4 h-1 bg-gray-900 rounded-full"></div>
                <div className="absolute top-6 right-3 w-4 h-1 bg-gray-900 rounded-full"></div>
                
                {/* Serene smile */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-6 h-2 border-b-2 border-gray-900 rounded-full"></div>
                
                {/* Third eye chakra */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-400 rounded-full animate-pulse-glow"></div>
            </div>

            {/* Neck */}
            <div className="w-7 h-3 bg-gradient-to-b from-amber-500 to-amber-600 mx-auto"></div>
            
            {/* Upper body in meditation robe */}
            <div className="relative w-20 h-24 bg-gradient-to-br from-orange-600 to-orange-800 rounded-t-3xl mx-auto border-2 border-orange-900 shadow-2xl">
                {/* Robe detail */}
                <div className="absolute top-0 inset-x-4 h-3 bg-orange-700 rounded-t-lg"></div>
            </div>

            {/* Arms in namaste position */}
            <div className="absolute top-28 left-1/2 -translate-x-1/2 flex gap-1">
                <div className="w-6 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full border-2 border-amber-700 shadow-lg"></div>
            </div>

            {/* Legs in lotus position */}
            <div className="relative w-32 h-16 mx-auto">
                <div className="absolute bottom-0 left-0 w-16 h-12 bg-gradient-to-br from-blue-700 to-blue-900 rounded-full border-2 border-blue-800 shadow-lg"></div>
                <div className="absolute bottom-0 right-0 w-16 h-12 bg-gradient-to-br from-blue-700 to-blue-900 rounded-full border-2 border-blue-800 shadow-lg"></div>
            </div>
        </div>

        {/* Om symbol */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 text-6xl opacity-20 animate-pulse-slow">🕉️</div>

        {/* Status - Z-INDEX 50 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 flex items-center gap-2">
                <span className="text-xl">🧘</span> 
                <span>Finding inner peace...</span>
            </p>
        </div>

        <style>{`
            @keyframes pulse-slow {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.05); }
            }
            @keyframes pulse-slower {
                0%, 100% { opacity: 0.4; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.1); }
            }
            @keyframes ripple {
                0% { transform: scale(1); opacity: 0.5; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes ripple-delayed {
                0% { transform: scale(1); opacity: 0.4; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes ripple-slower {
                0% { transform: scale(1); opacity: 0.3; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes float-gentle {
                0%, 100% { transform: translateY(0) scale(1.4); }
                50% { transform: translateY(-8px) scale(1.42); }
            }
            @keyframes float-petal {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(180deg); }
            }
            @keyframes float-petal-delayed {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-25px) rotate(-180deg); }
            }
            @keyframes float-petal-slow {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-15px) rotate(90deg); }
            }
            @keyframes pulse-glow {
                0%, 100% { opacity: 0.6; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5); }
                50% { opacity: 1; box-shadow: 0 0 15px rgba(168, 85, 247, 1); }
            }
            .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
            .animate-pulse-slower { animation: pulse-slower 4s ease-in-out infinite; }
            .animate-ripple { animation: ripple 3s ease-out infinite; }
            .animate-ripple-delayed { animation: ripple-delayed 3s ease-out infinite 1s; }
            .animate-ripple-slower { animation: ripple-slower 3s ease-out infinite 2s; }
            .animate-float-gentle { animation: float-gentle 5s ease-in-out infinite; }
            .animate-float-petal { animation: float-petal 6s ease-in-out infinite; }
            .animate-float-petal-delayed { animation: float-petal-delayed 7s ease-in-out infinite 1s; }
            .animate-float-petal-slow { animation: float-petal-slow 8s ease-in-out infinite 2s; }
            .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        `}</style>
    </div>
);

// TV Animation for general watching
const TVAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden bg-slate-900">
        {/* Glow behind TV */}
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] animate-pulse-glow"></div>

        {/* TV Set */}
        <div className="relative z-10 w-64 h-48 bg-gray-800 rounded-2xl border-8 border-gray-700 shadow-2xl flex flex-col overflow-hidden">
            
            {/* Screen Area */}
            <div className="relative flex-1 bg-black overflow-hidden m-2 rounded-lg border-2 border-gray-900">
                {/* Static Noise / Signal Effect */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMwMDAiLz48cmVjdCB4PSIzIiB5PSIyIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMzMzIi8+PC9zdmc+')] opacity-20 animate-static"></div>
                
                {/* Screen Glow/Gradient Animation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900 via-purple-900 to-blue-900 animate-screen-shift opacity-80"></div>
                
                {/* Play Symbol */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-white/20 rounded-full flex items-center justify-center animate-pulse">
                        <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white/80 border-b-[10px] border-b-transparent ml-1"></div>
                    </div>
                </div>

                {/* Scanlines */}
                <div 
                    className="absolute inset-0 z-20 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06))',
                        backgroundSize: '100% 2px, 3px 100%'
                    }}
                ></div>
            </div>

            {/* TV Bottom Panel */}
            <div className="h-8 bg-gray-700 flex items-center justify-between px-4">
                {/* Power Light */}
                <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)] animate-pulse"></div>
                {/* Speaker Grills */}
                <div className="flex gap-1">
                    <div className="w-1 h-3 bg-gray-900 rounded-full"></div>
                    <div className="w-1 h-3 bg-gray-900 rounded-full"></div>
                    <div className="w-1 h-3 bg-gray-900 rounded-full"></div>
                </div>
            </div>
        </div>

        {/* TV Stand */}
        <div className="absolute bottom-10 w-24 h-4 bg-gray-700 rounded-b-lg z-0"></div>
        <div className="absolute bottom-6 w-32 h-2 bg-gray-800 rounded-full z-0 opacity-50 blur-sm"></div>

        {/* Status Text - Z-INDEX 50 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-xl">📺</span> 
                <span>Ready to watch...</span>
            </p>
        </div>

        <style>{`
            @keyframes static {
                0% { background-position: 0 0; }
                100% { background-position: 100% 100%; }
            }
            @keyframes screen-shift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes pulse-glow {
                0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
            }
            .animate-static { animation: static 0.5s linear infinite; }
            .animate-screen-shift { background-size: 200% 200%; animation: screen-shift 5s ease infinite; }
            .animate-pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
        `}</style>
    </div>
);

// Coffee/Snack Animation
const CoffeeBreakAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden bg-[#5D4037]">
        {/* Steam Animation */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-24">
             <div className="flex gap-4">
                <div className="w-4 h-16 bg-white/20 rounded-full blur-md animate-steam-1"></div>
                <div className="w-4 h-24 bg-white/20 rounded-full blur-md animate-steam-2"></div>
                <div className="w-4 h-20 bg-white/20 rounded-full blur-md animate-steam-3"></div>
             </div>
        </div>

        {/* Coffee Cup */}
        <div className="relative z-10 mt-12">
            <div className="relative w-48 h-40 bg-white rounded-b-[3rem] rounded-t-lg shadow-2xl border-t-8 border-gray-100 flex items-center justify-center overflow-hidden">
                 {/* Coffee Liquid */}
                 <div className="absolute top-4 w-40 h-32 bg-[#3E2723] rounded-b-[2rem] shadow-inner"></div>
                 {/* Reflection */}
                 <div className="absolute top-4 right-4 w-32 h-32 bg-white/5 rounded-full blur-lg"></div>
            </div>
            {/* Handle */}
            <div className="absolute top-4 -right-12 w-16 h-24 border-8 border-white rounded-r-3xl -z-10"></div>
            {/* Saucer */}
            <div className="absolute -bottom-4 -left-8 w-64 h-8 bg-white rounded-full shadow-lg z-[-1]"></div>
        </div>

        {/* Background elements */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
             <div className="absolute top-10 left-10 text-6xl animate-pulse-slow">🍩</div>
             <div className="absolute bottom-10 right-10 text-6xl animate-bounce-subtle">🍪</div>
        </div>

        {/* Status Text */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-xl">☕</span> 
                <span>Refueling...</span>
            </p>
        </div>

        <style>{`
            @keyframes steam-1 { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 50% { opacity: 0.6; transform: translateY(-20px) scaleX(1.2); } 100% { opacity: 0; transform: translateY(-40px) scaleX(1); } }
            @keyframes steam-2 { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 50% { opacity: 0.5; transform: translateY(-30px) scaleX(0.8); } 100% { opacity: 0; transform: translateY(-60px) scaleX(1); } }
            @keyframes steam-3 { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 50% { opacity: 0.7; transform: translateY(-25px) scaleX(1.1); } 100% { opacity: 0; transform: translateY(-50px) scaleX(1); } }
            .animate-steam-1 { animation: steam-1 3s infinite linear; }
            .animate-steam-2 { animation: steam-2 4s infinite linear 1s; }
            .animate-steam-3 { animation: steam-3 3.5s infinite linear 0.5s; }
        `}</style>
    </div>
);

// Reading Animation
const ReadingAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden bg-emerald-900">
        {/* Background Library Vibe */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-800 to-emerald-950"></div>
        
        {/* Floating books */}
        <div className="absolute top-12 left-12 text-4xl animate-float-slow opacity-30">📚</div>
        <div className="absolute bottom-16 right-12 text-4xl animate-float-slower opacity-30">📖</div>

        {/* Reader Character */}
        <div className="relative z-10 animate-pulse-slow scale-110">
             {/* Head */}
             <div className="w-20 h-20 bg-[#F5D0C5] rounded-full mx-auto relative z-10">
                <div className="absolute top-6 left-3 w-4 h-4 bg-gray-800 rounded-full"></div> {/* Glasses L */}
                <div className="absolute top-6 right-3 w-4 h-4 bg-gray-800 rounded-full"></div> {/* Glasses R */}
                <div className="absolute top-7 left-3 w-4 h-1 bg-white/50"></div> {/* Glint */}
                <div className="absolute top-8 left-8 w-1 h-3 bg-[#D7B4AA] rounded-full"></div> {/* Nose */}
             </div>
             {/* Body */}
             <div className="w-28 h-32 bg-blue-600 rounded-t-3xl -mt-2 mx-auto relative shadow-xl">
                 {/* Hands holding book */}
                 <div className="absolute top-16 -left-6 w-8 h-8 bg-[#F5D0C5] rounded-full"></div>
                 <div className="absolute top-16 -right-6 w-8 h-8 bg-[#F5D0C5] rounded-full"></div>
             </div>
             {/* Book */}
             <div className="absolute top-20 left-1/2 -translate-x-1/2 w-48 h-32 bg-white rounded-md shadow-2xl flex border-b-8 border-gray-300">
                 <div className="flex-1 border-r border-gray-200 relative">
                     <div className="absolute top-4 left-4 right-4 h-2 bg-gray-200 rounded"></div>
                     <div className="absolute top-8 left-4 right-4 h-2 bg-gray-200 rounded"></div>
                     <div className="absolute top-12 left-4 right-8 h-2 bg-gray-200 rounded"></div>
                 </div>
                 <div className="flex-1 relative">
                     <div className="absolute top-4 left-4 right-4 h-2 bg-gray-200 rounded"></div>
                     <div className="absolute top-8 left-4 right-4 h-2 bg-gray-200 rounded"></div>
                     <div className="absolute top-12 left-4 right-8 h-2 bg-gray-200 rounded"></div>
                 </div>
             </div>
        </div>

        {/* Status Text */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-xl">📖</span> 
                <span>Lost in a story...</span>
            </p>
        </div>
    </div>
);

// Default Relax/Play Animation
const RelaxAnimation: React.FC = () => (
    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden bg-sky-300 dark:bg-sky-900">
        {/* Clouds */}
        <div className="absolute top-10 left-10 w-24 h-8 bg-white rounded-full blur-md opacity-80 animate-float-slow"></div>
        <div className="absolute top-24 right-20 w-32 h-10 bg-white rounded-full blur-md opacity-70 animate-float-slower"></div>
        <div className="absolute bottom-20 left-1/4 w-20 h-6 bg-white rounded-full blur-md opacity-60 animate-float-slow"></div>

        {/* Character on a cloud/beanbag */}
        <div className="relative z-10 animate-float-gentle">
            {/* The Cloud Seat */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-white rounded-full filter blur-sm opacity-90"></div>
            <div className="relative w-64 h-32 bg-white rounded-full shadow-xl flex items-center justify-center">
                
                {/* Character Body */}
                <div className="relative -top-10">
                    {/* Legs crossed */}
                    <div className="absolute bottom-0 left-0 w-20 h-8 bg-blue-700 rounded-full transform -rotate-12"></div>
                    <div className="absolute bottom-0 right-0 w-20 h-8 bg-blue-700 rounded-full transform rotate-12"></div>
                    
                    {/* Torso leaning back */}
                    <div className="w-24 h-28 bg-blue-500 rounded-2xl mx-auto relative z-10 transform -rotate-6">
                        <div className="absolute top-4 inset-x-0 h-full bg-black/10 rounded-2xl"></div> {/* Shirt detail */}
                    </div>

                    {/* Head */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-20 h-22 bg-[#F5D0C5] rounded-2xl shadow-md z-20 transform -rotate-6">
                        {/* Hair */}
                        <div className="absolute -top-2 -left-2 -right-2 h-10 bg-amber-800 rounded-t-xl"></div>
                        {/* Sunglasses */}
                        <div className="absolute top-8 left-2 w-7 h-5 bg-black rounded-lg"></div>
                        <div className="absolute top-8 right-2 w-7 h-5 bg-black rounded-lg"></div>
                        <div className="absolute top-9 left-9 w-2 h-1 bg-black"></div>
                        {/* Smile */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-3 border-b-4 border-gray-800 rounded-full"></div>
                    </div>

                    {/* Arms behind head */}
                    <div className="absolute -top-16 -left-8 w-12 h-24 bg-blue-400 rounded-full transform rotate-45 -z-10"></div>
                    <div className="absolute -top-16 -right-8 w-12 h-24 bg-blue-400 rounded-full transform -rotate-45 -z-10"></div>
                </div>
            </div>
        </div>

        {/* Floating Icons of Leisure */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 text-4xl animate-bounce-subtle opacity-80">🎮</div>
            <div className="absolute top-1/3 right-1/4 text-4xl animate-pulse-slow opacity-80">⚽</div>
            <div className="absolute bottom-1/3 left-1/3 text-4xl animate-float-slow opacity-80">🎨</div>
        </div>

        {/* Status Text */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
            <p className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-xl">✨</span> 
                <span>Break Mode Activated</span>
            </p>
        </div>
    </div>
);


const getPlatformInfo = (url: string): { 
    platform: string; 
    icon: string; 
    isYouTube: boolean; 
    isTikTok: boolean; 
    videoId?: string;
    fullUrl?: string;
} => {
    if (!url) return { platform: 'Break', icon: '☕', isYouTube: false, isTikTok: false };
    
    // Normalize URL
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
        cleanUrl = `https://${cleanUrl}`;
    }

    try {
        const urlObj = new URL(cleanUrl);
        const hostname = urlObj.hostname.toLowerCase();

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            let videoId: string | null = null;
            if (hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            } else if (urlObj.pathname.includes('/shorts/')) {
                videoId = urlObj.pathname.split('/shorts/')[1].split('?')[0];
            } else {
                videoId = urlObj.searchParams.get('v');
            }
            return { 
                platform: 'YouTube', 
                icon: '▶️', 
                isYouTube: true, 
                isTikTok: false, 
                videoId: videoId || undefined,
                fullUrl: cleanUrl
            };
        }

        if (hostname.includes('tiktok.com')) {
            // Extract video ID from various TikTok URL formats
            const parts = urlObj.pathname.split('/');
            const videoIndex = parts.indexOf('video');
            let videoId: string | undefined;
            
            if (videoIndex !== -1 && parts.length > videoIndex + 1) {
                videoId = parts[videoIndex + 1].split('?')[0];
            }
            
            return { 
                platform: 'TikTok', 
                icon: '🎵', 
                isYouTube: false, 
                isTikTok: true, 
                videoId,
                fullUrl: cleanUrl
            };
        }
        
        if (hostname.includes('instagram.com')) return { platform: 'Instagram', icon: '📸', isYouTube: false, isTikTok: false, fullUrl: cleanUrl };
        if (hostname.includes('spotify.com')) return { platform: 'Spotify', icon: '🎧', isYouTube: false, isTikTok: false, fullUrl: cleanUrl };
        if (hostname.includes('netflix.com')) return { platform: 'Netflix', icon: '🍿', isYouTube: false, isTikTok: false, fullUrl: cleanUrl };
        if (hostname.includes('twitch.tv')) return { platform: 'Twitch', icon: '🎮', isYouTube: false, isTikTok: false, fullUrl: cleanUrl };

    } catch (e) {
        console.error('URL parsing error:', e);
    }
    
    return { platform: 'Web', icon: '🌐', isYouTube: false, isTikTok: false, fullUrl: cleanUrl };
};

// Updated TikTok Embed Component - Thumbnail Style Card
const TikTokEmbed: React.FC<{ videoId?: string; fullUrl: string }> = ({ videoId, fullUrl }) => {
    const handleOpen = () => {
        window.open(fullUrl, '_blank');
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-black rounded-2xl border-2 border-gray-800 shadow-2xl h-full relative overflow-hidden group cursor-pointer" onClick={handleOpen}>
             {/* Background decorative blobs */}
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-[#ff0050] to-[#00f2ea] animate-spin-slow opacity-30 blur-3xl"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform relative border border-gray-800">
                    <svg viewBox="0 0 24 24" className="w-12 h-12 relative z-10" style={{ filter: 'drop-shadow(2px 2px 0px rgba(255,0,80,0.5)) drop-shadow(-2px -2px 0px rgba(0,242,234,0.5))' }}>
                        {/* Cyan Offset Layer */}
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 1 0 1 7.6 6.83 6.83 0 0 0 4.46-6.52V5.91A10.3 10.3 0 0 0 19.59 6.69Z" fill="#00f2ea" style={{ transform: 'translate(-2px, -2px)', opacity: 0.8 }} />
                        {/* Red Offset Layer */}
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 1 0 1 7.6 6.83 6.83 0 0 0 4.46-6.52V5.91A10.3 10.3 0 0 0 19.59 6.69Z" fill="#ff0050" style={{ transform: 'translate(2px, 2px)', opacity: 0.8 }} />
                        {/* Main White Layer */}
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 1 0 1 7.6 6.83 6.83 0 0 0 4.46-6.52V5.91A10.3 10.3 0 0 0 19.59 6.69Z" fill="#ffffff" />
                    </svg>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Watch on TikTok</h3>
                <p className="text-gray-300 text-sm mb-8 max-w-xs text-center">
                    Click to open this video in the TikTok app or website.
                </p>

                <div className="bg-gray-800/80 backdrop-blur-sm p-4 rounded-xl border border-gray-700 flex items-center gap-3">
                    <span className="text-2xl">⏰</span>
                    <p className="text-sm font-medium text-white text-left">
                        Don't worry! We'll sound an <strong>alarm</strong> when your break ends.
                    </p>
                </div>
            </div>
            
             {videoId && (
             <div className="absolute bottom-4 text-xs text-gray-500 font-mono opacity-50">
                Video ID: {videoId}
            </div>
            )}
            <style>{`
                @keyframes spin-slow {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 20s linear infinite;
                }
            `}</style>
        </div>
    );
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const BreakView: React.FC<BreakViewProps> = ({ session, onEnd }) => {
    const { t } = useLanguage();
    const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.round((session.endTime - Date.now()) / 1000)));
    const [hasOpenedLink, setHasOpenedLink] = useState(false);
    
    // Play sound on mount (Break Start)
    useEffect(() => {
        // Add a slight delay to ensure user interaction registers if triggered by click
        setTimeout(() => {
            notificationService.playBreakStartSound();
        }, 100);
    }, []);

    const url = session.fromSlot.link || '';
    const activity = (session.fromSlot.activity || '').toLowerCase();
    const { platform, icon, isYouTube, isTikTok, videoId, fullUrl } = getPlatformInfo(url);

    // Determine which animation to show based on activity
    const getActivityAnimation = () => {
        if (isYouTube && videoId) return null; // Show YouTube embed
        if (isTikTok) return null; // Show TikTok card (even if no ID extracted, avoiding TV animation)
        
        // Activity-based animations (keep your existing logic)
        if (activity.includes('watch') || activity.includes('youtube') || activity.includes('tiktok') || activity.includes('netflix') || activity.includes('movie')) {
            return <TVAnimation />;
        }
        if (activity.includes('walk') || activity.includes('run') || activity.includes('jog') || activity.includes('hike')) return <WalkingPersonAnimation />;
        if (activity.includes('music') || activity.includes('listen') || activity.includes('podcast')) return <MusicListeningAnimation />;
        if (activity.includes('meditat') || activity.includes('mindful') || activity.includes('yoga') || activity.includes('breath')) return <MeditationAnimation />;
        if (activity.includes('coffee') || activity.includes('tea') || activity.includes('eat') || activity.includes('snack') || activity.includes('lunch') || activity.includes('dinner')) return <CoffeeBreakAnimation />;
        if (activity.includes('read') || activity.includes('book') || activity.includes('novel') || activity.includes('study')) return <ReadingAnimation />;
        
        return <RelaxAnimation />;
    };

    const handleEnd = useCallback(async (skipped = false) => {
        document.title = "EduBlay Study Hub";
        
        if (!skipped) {
            await notificationService.playBreakEndSound();
            notificationService.sendNotification(t('toasts.breakOver'), {
                body: "Time to get back to studying! Click here to return.",
                requireInteraction: true,
                tag: 'break-end'
            });
        }
        onEnd(skipped);
    }, [onEnd, t]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const remaining = Math.max(0, Math.round((session.endTime - Date.now()) / 1000));
                document.title = `${formatTime(remaining)} - Break`;

                if (remaining <= 0) {
                    clearInterval(timer);
                    handleEnd(false);
                    return 0;
                }
                return remaining;
            });
        }, 1000);

        return () => {
            clearInterval(timer);
            document.title = "EduBlay Study Hub";
        };
    }, [handleEnd, session.endTime]);

    const openLink = () => {
        if (fullUrl) {
            window.open(fullUrl, '_blank');
            setHasOpenedLink(true);
        }
    };

    const animation = getActivityAnimation();

    return (
        <div className="fixed inset-0 bg-gray-900/98 flex items-center justify-center z-[110] backdrop-blur-lg">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-5xl text-center border-2 border-gray-700 relative overflow-hidden flex flex-col max-h-[95vh]">
                {/* Animated gradient border */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 animate-gradient-shift"></div>
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg transform rotate-6">
                            {icon}
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                {session.fromSlot.activity || t('breakview.title')}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('breakview.body')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 animate-gradient-text">
                            {formatTime(timeLeft)}
                        </div>
                        <p className="text-xs text-gray-400 font-semibold">Time Remaining</p>
                    </div>
                </div>

                {/* Main content area */}
                <div className="flex-1 flex flex-col justify-center min-h-0 p-4 relative">
                    {isYouTube && videoId ? (
                        <div className="w-full h-full max-h-full aspect-video mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-700">
                            <iframe 
                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&origin=${window.location.origin}`}
                                className="w-full h-full"
                                title="Break Video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                style={{ border: 'none' }}
                            />
                        </div>
                    ) : isTikTok && fullUrl ? (
                        <TikTokEmbed videoId={videoId} fullUrl={fullUrl} />
                    ) : animation ? (
                        <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-700 h-full">
                            {animation}
                        </div>
                    ) : fullUrl ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-inner h-full">
                            {!hasOpenedLink ? (
                                <>
                                    <div className="text-6xl mb-6 animate-bounce">{icon}</div>
                                    <p className="text-xl text-blue-800 dark:text-blue-300 mb-8 font-semibold">
                                        Your activity is ready on <strong>{platform}</strong>
                                    </p>
                                    <button 
                                        onClick={openLink}
                                        className="py-4 px-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-bold shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 text-lg"
                                    >
                                        <span>Open {platform}</span>
                                        <ExternalLinkIcon className="w-6 h-6" />
                                    </button>
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="text-6xl mb-4 animate-pulse">✨</div>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-2">Enjoy your break!</p>
                                    <p className="text-blue-600 dark:text-blue-400 mb-6">We'll notify you when it's time to return.</p>
                                    <button onClick={openLink} className="text-sm text-blue-500 hover:underline flex items-center gap-1 mx-auto font-medium">
                                        Re-open link <ExternalLinkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                    {fullUrl && (
                        <button 
                            onClick={openLink} 
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-2 font-medium transition-colors"
                        >
                            <ExternalLinkIcon className="w-4 h-4" />
                            Open in new tab
                        </button>
                    )}
                    <button 
                        onClick={() => handleEnd(true)}
                        className="ml-auto px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
                    >
                        <PlayIcon className="w-4 h-4" />
                        {t('breakview.skip')}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes gradient-shift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes gradient-text {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-shift {
                    background-size: 200% 200%;
                    animation: gradient-shift 3s ease infinite;
                }
                .animate-gradient-text {
                    background-size: 200% 200%;
                    animation: gradient-text 3s ease infinite;
                }
            `}</style>
        </div>
    );
};

export default BreakView;
