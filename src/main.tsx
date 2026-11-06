import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/ThemeProvider';
import '@/lib/firebaseConfig';

const Index = lazy(() => import('@/pages/Index'));
const Seguimiento = lazy(() => import('@/pages/Seguimiento'));
const MiWinSeguimiento = lazy(() => import('@/pages/MiWinSeguimiento'));

const PageLoader = () => (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-[#FF5A0A] border-t-transparent rounded-full animate-spin" />
    </div>
);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed:', err);
    });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="light" storageKey="win-ui-theme">
            <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/seguimiento/:token" element={<Seguimiento />} />
                        <Route path="/miwin/v/:token" element={<MiWinSeguimiento />} />
                        <Route path="/miwin/v" element={<MiWinSeguimiento />} />
                        <Route path="/miwin/:dni" element={<MiWinSeguimiento />} />
                        <Route path="/miwin" element={<MiWinSeguimiento />} />
                    </Routes>
                </Suspense>
                <Toaster />
            </BrowserRouter>
        </ThemeProvider>
    </React.StrictMode>,
);