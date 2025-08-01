const axios = require('axios');

async function testAPI() {
    try {
        console.log('Sending request to API...');
        const response = await axios.post('http://localhost:3001/ask-agent', {
            query: 'danışma nerede'
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error details:');
        console.error('Message:', error.message);
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        console.error('Full error:', error);
    }
}

testAPI(); 