<template>
  <div>
    <h1>Spec Detail</h1>
    <p>Spec ID: {{ route.params.specId }}</p>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
