<template>
  <div>
    <h1>Project Detail</h1>
    <p>Project ID: {{ route.params.id }}</p>
    <!-- Full implementation with specs and tickets list -->
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
