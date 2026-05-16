<template>
  <div>
    <h1>Ticket Detail</h1>
    <p>Ticket ID: {{ route.params.ticketId }}</p>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
