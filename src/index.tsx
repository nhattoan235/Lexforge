import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AssistantChat from './components/AssistantChat';
import ToastHost from './components/Feedback/ToastHost';
import {migrateLegacyChat} from './services/conversations';

void migrateLegacyChat().catch(()=>{ /* Keep the original local chat if migration is unavailable. */ });

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode>{new URLSearchParams(window.location.search).get('assistantChat')==='1'?<><AssistantChat embedded/><ToastHost/></>:<App />}</React.StrictMode>);
