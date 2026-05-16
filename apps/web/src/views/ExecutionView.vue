<template>
  <div v-if="execution">
    <div class="header">
      <h2>Execution #{{ execution.id }}</h2>
      <span :class="`status-${execution.status.toLowerCase().replace(/\s+/g, '-')}`">{{ execution.status }}</span>
      <button
        v-if="isRunning"
        @click="handleStop"
        class="btn-danger"
      >
        Stop
      </button>
    </div>

    <div class="log-container">
      <div
        v-for="(log, i) in logs"
        :key="i"
        :class="`log-line log-${log.level}`"
      >
        <span class="log-time">{{ formatTime(log.created_at) }}</span>
        <span class="log-source">[{{ log.source }}]</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
  <div v-else-if="loading">Loading execution...</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useExecutionsStore } from '../stores/executions.js';
import { storeToRefs } from 'pinia';

const route = useRoute();
const executionId = Number(route.params.id);
const store = useExecutionsStore();
const { current: execution, logs, loading, error } = storeToRefs(store);

const isRunning = computed(() =>
  ['Queued', 'Preparing Workspace', 'Running Agent', 'Running Verification'].includes(
    execution.value?.status ?? '',
  ),
);

onMounted(async () => {
  await store.fetchExecution(executionId);
  if (isRunning.value) {
    store.subscribe(executionId);
  }
});

onUnmounted(() => {
  store.unsubscribe(executionId);
});

async function handleStop(): Promise<void> {
  await store.stopExecution(executionId);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
</script>
