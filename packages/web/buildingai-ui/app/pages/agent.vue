<template>
  <div class="container">
    <AgentChat /> <!-- 引入点餐台组件 -->
  </div>
</template>

<script setup lang="ts">
import AgentChat from "~/components/AgentChat.vue";
</script>

<style scoped>
.container { padding: 20px; }
</style>