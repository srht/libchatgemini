// src/components/Chatbot.js
import { useState, useEffect, useRef } from 'react';
import axios from 'axios'; // API çağrıları için

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
        <div style={{ width: '100%', margin: '20px auto', border: '1px solid #ccc', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', height: '80vh' }}>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
                {messages.map((msg, index) => (
                    <div style={{clear:'both'}}>
                    <div key={index} style={{
                        textAlign: msg.sender === 'user' ? 'right' : 'left',
                        float: msg.sender === 'user' ? 'right' : 'left',
                        margin: '5px 0',
                        padding: '8px 12px',
                        borderRadius: '15px',
                        backgroundColor: msg.sender === 'user' ? '#e0f7fa' : '#f0f0f0',
                        maxWidth: '70%',
                        wordWrap: 'break-word',
                        color: msg.sender === 'user' ? '#000' : '#333',
                    }}>
                        <p dangerouslySetInnerHTML={{ __html: msg.text }}></p>
                        
                    </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ textAlign: 'left', margin: '5px 0' }}>
                        <span style={{ padding: '8px 12px', borderRadius: '15px', backgroundColor: '#f0f0f0' }}>Yazıyor...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                        }
                    }}
                    placeholder="Mesajınızı yazın..."
                    disabled={loading}
                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif', fontSize: '14px', resize: 'none' }}
                />
                <button type="submit" disabled={loading} style={{ padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}>
                    Gönder
                </button>
            </form>
        </div>
    );
}

export default Chatbot;