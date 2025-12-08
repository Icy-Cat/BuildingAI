<template>
  <div class="chat-box">
    <h3>AI 助手（对接 Coze）test</h3>
    <div class="chat-history">
      <div 
        v-for="(msg, idx) in chatHistory" 
        :key="idx" 
        :class="`msg ${msg.role}`"
      >
        <span class="name">{{ msg.role === 'user' ? '我' : 'AI 助手' }}：</span>
        <span class="content">{{ msg.content }}</span>
      </div>
    </div>
    <div class="chat-input">
      <textarea
        v-model="userInput"
        placeholder="输入你想问的问题..."
        @keydown.enter.prevent="sendMsg"
      ></textarea>
      <button @click="sendMsg" :disabled="isLoading">
        {{ isLoading ? '发送中...' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

// 聊天记录（存储点餐记录和菜品）
const chatHistory = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
// 用户输入（点餐内容）
const userInput = ref('');
// 加载状态（是否在取餐）
const isLoading = ref(false);

// 发送订单（点餐）
const sendMsg = async () => {
  const msg = userInput.value.trim();
  if (!msg) return;

  // 1. 添加用户的点餐记录
  chatHistory.value.push({ role: 'user', content: msg });
  userInput.value = '';
  isLoading.value = true;

  try {
    // 2. 给服务员递订单（调用后端接口）
    const res = await axios.post('/api/agent/chat', {
      userMessage: msg,
      userId: 'test_user_123', // 可替换成你的系统用户 ID（没有就留空）
    });

    // --- 修复后的代码开始：安全获取回复 ---
    const responseData = res.data?.data; // 安全地获取 res.data.data

    // 3. 接收菜品（Agent 回复）- 检查数据结构是否符合预期
    if (responseData && responseData.reply) {
      // 成功获取回复内容
      chatHistory.value.push({ role: 'assistant', content: responseData.reply });
    } else {
      // 响应 200 OK，但缺少 reply 字段（业务失败或格式不符）
      // 尝试获取后端返回的 message 字段作为错误提示
      const errorMsg = res.data.message || '点餐失败：后端返回数据格式不正确或缺少回复内容。';
      chatHistory.value.push({ role: 'assistant', content: errorMsg });
      console.error('点餐失败：后端响应缺少回复数据', res.data);
    }
    // --- 修复后的代码结束 ---

  } catch (err) {
    // HTTP 请求失败 (如 4xx/5xx 状态码或网络错误)
    chatHistory.value.push({ role: 'assistant', content: '调用失败，请检查网络或服务器状态～' });
    console.error('点餐失败（网络或服务器）：', err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.chat-box { max-width: 800px; margin: 20px auto; border: 1px solid #eee; border-radius: 8px; }
.chat-history { height: 400px; overflow-y: auto; padding: 20px; background: #f9f9f9; }
.msg { margin: 10px 0; padding: 8px 12px; border-radius: 6px; }
.msg.user { background: #e3f2fd; text-align: right; }
.msg.assistant { background: #f5f5f5; text-align: left; }
.name { font-weight: bold; margin-right: 8px; }
.chat-input { display: flex; padding: 20px; border-top: 1px solid #eee; }
textarea { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: none; height: 80px; margin-right: 10px; }
button { padding: 0 20px; background: #42b983; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { background: #ccc; cursor: not-allowed; }
</style>