// src/components/Chatbot.js
import { useState, useEffect, useRef } from 'react';
import axios from 'axios'; // API çağrıları için
import './Chatbot.css';

function Chatbot() {
    type Message = { sender: string; text: string };
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Mesajlar güncellendiğinde en alta kaydır
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e:any) => {
        e.preventDefault();
        if (input.trim() === '') return;

        const userMessage = { sender: 'user', text: input };
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Arka uç API'nize sorguyu gönderin
            const response = await axios.post('http://localhost:3001/ask-agent', { query: input });
            //const response = await axios.post('https://service.library.itu.edu.tr/chat/api/ask-agent', { query: input });
            const botMessage = { sender: 'bot', text: response.data.response };
            setMessages((prevMessages) => [...prevMessages, botMessage]);
        } catch (error) {
            console.error('Chatbot API hatası:', error);
            setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: 'Üzgünüm, bir hata oluştu.' }]);
        } finally {
            setLoading(false);
            scrollToBottom();
        }

        
    };
/*
    const handleFileUpload = async (e:any) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('document', file);

        try {
            // Arka uç API'nize dosyayı gönderin
            await axios.post('http://localhost:3001/upload-document', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('Dosya başarıyla yüklendi ve indekslendi!');
        } catch (error) {
            console.error('Dosya yükleme hatası:', error);
            alert('Dosya yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };
*/
    return (
        <div className="chatbot-container">
            
            <div className="chatbot-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`message-wrapper ${msg.sender === 'user' ? 'user-message' : 'bot-message'}`}>
                        <div className={`message ${msg.sender === 'user' ? 'user' : 'bot'}`}>
                            <p dangerouslySetInnerHTML={{ __html: msg.text }}></p>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="message-wrapper bot-message">
                        <div className="message bot typing">
                            <span className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                            Yazıyor...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chatbot-input-form">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                        }
                    }}
                    placeholder="Mesajınızı yazın... (Enter ile gönder, Shift+Enter ile yeni satır)"
                    disabled={loading}
                    className="chatbot-textarea"
                />
                <button type="submit" disabled={loading} className="chatbot-send-btn">
                    {loading ? 'Gönderiliyor...' : 'Gönder'}
                </button>
            </form>
        </div>
    );
}

export default Chatbot;