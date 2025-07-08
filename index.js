// DOM 元素引用
const chatArea = document.getElementById('chat-area');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');


// API 配置 - 请替换为你的实际API地址
const API_URL = 'https://your-netlify-site.netlify.app/.netlify/functions/fetchentity';;

// 自动调整textarea高度
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    updateSendButton();
});

// 更新发送按钮状态
function updateSendButton() {
    sendBtn.disabled = userInput.value.trim() === '';
}

// 发送消息并进行情感分析
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // 显示用户消息
    addMessage(message, 'user');
    
    // 清空输入框
    userInput.value = '';
    userInput.style.height = 'auto';
    updateSendButton();

    // 显示加载状态
    showTyping();

    try {
        // 调用实体情感分析API
        const analysisResult = await callEmotionAnalysisAPI(message);
        
        hideTyping();
        
        // 显示分析完成回复
        const response = "分析完成！以下是我识别出的实体和情感倾向：";
        addMessage(response, 'assistant');
        
        // 显示详细的情感分析结果
        setTimeout(() => {
            displayEmotionAnalysis(analysisResult);
        }, 300);
        
    } catch (error) {
        hideTyping();
        console.error('情感分析失败:', error);
        
        // 显示错误消息
        addErrorMessage('抱歉，分析过程中出现了错误。请检查网络连接后重试。');
    }
}

// 调用实体情感分析API
async function callEmotionAnalysisAPI(userMessage) {
    try {
        console.log('正在调用API分析:', userMessage);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userMessage })
        });

        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const data = await response.json();
        console.log('API返回结果:', data);
        
        return data;
        
    } catch (error) {
        console.error('API调用错误:', error);
        throw error;
    }
}

// 显示情感分析结果
function displayEmotionAnalysis(analysisData) {
    const { entities, summary, originalMessage, analysis } = analysisData;
    
    const analysisDiv = document.createElement('div');
    analysisDiv.className = 'emotion-analysis';
    
    // 生成整体情感倾向的样式类和显示文本
    const sentimentClass = summary.sentiment;
    const sentimentText = {
        'positive': '积极',
        'negative': '消极', 
        'neutral': '中性'
    };

    // 构建分析结果HTML
    let analysisHTML = `
        <h3>🧠 实体情感分析结果</h3>
        
        <div class="emotion-summary">
            <div class="emotion-stats">
                <div class="emotion-stat positive">
                    <span>😍</span>
                    <span>喜欢: ${summary.emotions.positive}项</span>
                </div>
                <div class="emotion-stat negative">
                    <span>😞</span>
                    <span>不喜欢: ${summary.emotions.negative}项</span>
                </div>
                <div class="emotion-stat neutral">
                    <span>🤔</span>
                    <span>不确定: ${summary.emotions.neutral}项</span>
                </div>
            </div>
            <div>
                <span class="overall-sentiment ${sentimentClass}">
                    整体情感倾向: ${sentimentText[sentimentClass]}
                </span>
            </div>
        </div>
    `;

    // 检查是否有实体数据需要显示
    const hasEntities = Object.values(entities).some(categoryEntities => 
        Array.isArray(categoryEntities) && categoryEntities.length > 0
    );

    if (hasEntities) {
        analysisHTML += '<div class="entities-grid">';
        
        // 遍历每个实体类别
        Object.entries(entities).forEach(([category, categoryEntities]) => {
            if (Array.isArray(categoryEntities) && categoryEntities.length > 0) {
                // 类别名称映射
                const categoryNames = {
                    'People': '👥 人物',
                    'Items': '📦 物品', 
                    'Places': '📍 地点',
                    'Others': '🔗 其他'
                };
                
                analysisHTML += `
                    <div class="entity-category">
                        <h4>${categoryNames[category] || category}</h4>
                `;
                
                // 显示该类别下的所有实体
                categoryEntities.forEach(entity => {
                    const emotionEmoji = {
                        'like': '😍',
                        'dislike': '😞', 
                        'uncertain': '🤔'
                    };

                    const emotionText = {
                        'like': '喜欢',
                        'dislike': '不喜欢',
                        'uncertain': '不确定'
                    };
                    
                    analysisHTML += `
                        <div class="entity-item">
                            <span class="entity-name">${entity.name}</span>
                            <span class="entity-emotion ${entity.emotion}">
                                ${emotionEmoji[entity.emotion]} ${emotionText[entity.emotion]}
                            </span>
                        </div>
                    `;
                });
                
                analysisHTML += '</div>';
            }
        });
        
        analysisHTML += '</div>';
    } else {
        // 如果没有检测到实体
        analysisHTML += `
            <div style="text-align: center; color: #6b7280; padding: 20px;">
                <p>😶 未检测到明确的实体信息</p>
                <p style="font-size: 12px; margin-top: 8px;">尝试提供更具体的描述，包含人物、物品或地点等信息</p>
            </div>
        `;
    }
    
    analysisDiv.innerHTML = analysisHTML;
    chatArea.appendChild(analysisDiv);
    scrollToBottom();
}

// 添加消息到聊天区域
function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatArea.appendChild(messageDiv);
    scrollToBottom();
}

// 添加错误消息
function addErrorMessage(errorText) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorText;
    
    chatArea.appendChild(errorDiv);
    scrollToBottom();
}

// 显示打字指示器
function showTyping() {
    typingIndicator.style.display = 'flex';
    scrollToBottom();
}

// 隐藏打字指示器
function hideTyping() {
    typingIndicator.style.display = 'none';
}

// 滚动到聊天区域底部
function scrollToBottom() {
    setTimeout(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    }, 100);
}

// 清空对话历史
function clearChat() {
    const messages = chatArea.querySelectorAll('.message, .emotion-analysis, .error-message');
    messages.forEach(msg => msg.remove());
}

// 事件监听器设置
function setupEventListeners() {
    // 发送按钮点击事件
    sendBtn.addEventListener('click', sendMessage);
    
    // 输入框回车键事件
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 输入框焦点事件
    userInput.addEventListener('focus', () => {
        userInput.style.borderColor = '#2563eb';
    });
    
    userInput.addEventListener('blur', () => {
        userInput.style.borderColor = '#d1d5db';
    });
}

// 初始化应用
function initializeApp() {
    console.log('EmotiChat 应用初始化...');
    console.log('API地址:', API_URL);
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始化按钮状态
    updateSendButton();
    
    // 检查API配置
    if (API_URL.includes('your-netlify-site')) {
        console.warn('⚠️ 请在index.js中设置正确的API_URL');
        addErrorMessage('请配置正确的API地址后重新加载页面');
    }
    
    console.log('✅ 应用初始化完成');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeApp);

// 导出函数供HTML调用
window.clearChat = clearChat;