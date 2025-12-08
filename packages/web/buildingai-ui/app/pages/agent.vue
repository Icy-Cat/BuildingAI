<template>
  <div class="container">
    <AgentChat /> <!-- 引入点餐台组件 -->
  </div>
</template>

<script setup lang="ts">
import AgentChat from "~/components/AgentChat.vue";
</script>
<!-- 其中~代表D:\羲梦科技工作文件5\FastbuildAI\packages\web\buildingai-ui\app\ -->

<style scoped>
.container { padding: 20px; }
</style>