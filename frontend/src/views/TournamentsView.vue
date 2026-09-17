<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { createTournament, fetchTournaments, registerTournament } from "../api/tournaments";
import type { Tournament } from "../types";

const POLL_INTERVAL_MS = 2500;

const tournaments = ref<Tournament[]>([]);
const loading = ref(false);
const publishing = ref(false);
const registerNames = reactive<Record<string, string>>({});
const registerPending = reactive<Record<string, boolean>>({});
const groupDialogVisible = ref(false);
const activeTournament = ref<Tournament | null>(null);
const lastRefreshAt = ref("");

const publishForm = reactive({
  name: "",
  boardGame: "",
  startTime: "",
  maxParticipants: 8,
  groupSize: 4,
});

const openCount = computed(() => tournaments.value.filter((item) => item.status === "open").length);

let timer: ReturnType<typeof setInterval> | undefined;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

async function refresh(silent = true) {
  if (!silent) loading.value = true;
  try {
    tournaments.value = await fetchTournaments();
    lastRefreshAt.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    if (activeTournament.value) {
      const fresh = tournaments.value.find((item) => item.id === activeTournament.value?.id);
      if (fresh) activeTournament.value = fresh;
    }
  } catch (error) {
    if (!silent) ElMessage.error(error instanceof Error ? error.message : "赛事列表加载失败");
  } finally {
    loading.value = false;
  }
}

async function publish() {
  if (publishing.value) return;
  if (!publishForm.startTime) {
    ElMessage.warning("请选择开始时间");
    return;
  }
  publishing.value = true;
  try {
    await createTournament({
      name: publishForm.name,
      boardGame: publishForm.boardGame,
      startTime: new Date(publishForm.startTime).toISOString(),
      maxParticipants: publishForm.maxParticipants,
      groupSize: publishForm.groupSize,
    });
    ElMessage.success("赛事已发布");
    publishForm.name = "";
    publishForm.boardGame = "";
    publishForm.startTime = "";
    await refresh();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "发布失败");
  } finally {
    publishing.value = false;
  }
}

async function register(tournament: Tournament) {
  const player = (registerNames[tournament.id] ?? "").trim();
  if (!player) {
    ElMessage.warning("请输入玩家昵称");
    return;
  }
  if (registerPending[tournament.id]) return;
  registerPending[tournament.id] = true;
  try {
    await registerTournament(tournament.id, player);
    ElMessage.success(`${player} 报名成功`);
    registerNames[tournament.id] = "";
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "报名失败");
  } finally {
    registerPending[tournament.id] = false;
    await refresh();
  }
}

function openGroups(tournament: Tournament) {
  activeTournament.value = tournament;
  groupDialogVisible.value = true;
}

onMounted(() => {
  refresh(false);
  timer = setInterval(() => refresh(), POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <section class="tournament-layout">
    <article class="work-panel publish-panel">
      <h2>门店发布赛事</h2>
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="赛事名称">
          <el-input v-model="publishForm.name" maxlength="40" placeholder="如：狼人杀周末锦标赛" />
        </el-form-item>
        <el-form-item label="比赛桌游">
          <el-input v-model="publishForm.boardGame" maxlength="40" placeholder="如：狼人杀" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="publishForm.startTime"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 100%"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <div class="form-row">
          <el-form-item label="人数上限">
            <el-input-number v-model="publishForm.maxParticipants" :min="2" :max="128" />
          </el-form-item>
          <el-form-item label="每组人数">
            <el-input-number v-model="publishForm.groupSize" :min="2" :max="publishForm.maxParticipants" />
          </el-form-item>
        </div>
        <el-button type="primary" :loading="publishing" @click="publish">发布赛事</el-button>
      </el-form>
    </article>

    <article class="work-panel list-panel">
      <div class="list-head">
        <h2>赛事广场</h2>
        <span class="refresh-note">
          共 {{ tournaments.length }} 场（{{ openCount }} 场报名中）· 每 2.5 秒自动刷新 · 上次 {{ lastRefreshAt || "—" }}
        </span>
      </div>
      <el-empty v-if="!loading && tournaments.length === 0" description="还没有赛事，先发布一场吧" />
      <div v-loading="loading" class="tournament-list">
        <section v-for="item in tournaments" :key="item.id" class="tournament-card">
          <header class="card-head">
            <div>
              <strong class="card-title">{{ item.name }}</strong>
              <span class="card-sub">{{ item.boardGame }} · {{ formatTime(item.startTime) }} 开赛</span>
            </div>
            <el-tag :type="item.status === 'open' ? 'success' : 'info'" effect="dark">
              {{ item.status === "open" ? "报名中" : "已锁定·已分组" }}
            </el-tag>
          </header>

          <div class="seat-row">
            <el-progress
              :percentage="Math.round((item.registeredCount / item.maxParticipants) * 100)"
              :status="item.remainingSeats === 0 ? 'success' : undefined"
              :stroke-width="14"
              class="seat-progress"
            />
            <span class="seat-text">
              已报 {{ item.registeredCount }}/{{ item.maxParticipants }} ·
              <b :class="{ 'seat-empty': item.remainingSeats === 0 }">剩余 {{ item.remainingSeats }} 席</b>
            </span>
          </div>

          <div class="player-row">
            <span class="player-label">报名顺序：</span>
            <template v-if="item.participants.length">
              <el-tag
                v-for="(entry, index) in item.participants"
                :key="entry.player"
                size="small"
                effect="plain"
                class="player-tag"
              >
                {{ index + 1 }}. {{ entry.player }}
              </el-tag>
            </template>
            <span v-else class="player-empty">虚位以待</span>
          </div>

          <footer class="card-actions">
            <template v-if="item.status === 'open'">
              <el-input
                v-model="registerNames[item.id]"
                maxlength="24"
                placeholder="输入玩家昵称立即报名"
                class="register-input"
                @keyup.enter="register(item)"
              />
              <el-button
                type="primary"
                :disabled="item.remainingSeats === 0"
                :loading="registerPending[item.id]"
                @click="register(item)"
              >
                {{ item.remainingSeats === 0 ? "名额已满" : "立即报名" }}
              </el-button>
            </template>
            <el-button v-if="item.groups.length" type="warning" plain @click="openGroups(item)">
              查看分组（{{ item.groups.length }} 组）
            </el-button>
          </footer>
        </section>
      </div>
    </article>

    <el-dialog
      v-model="groupDialogVisible"
      :title="activeTournament ? `${activeTournament.name} · 分组结果` : '分组结果'"
      width="640px"
    >
      <p class="dialog-note">满员后按报名顺序轮流分组，任意两组人数差不超过 1，分组完成即锁定报名。</p>
      <div class="group-grid">
        <section v-for="group in activeTournament?.groups ?? []" :key="group.name" class="group-card">
          <header>{{ group.name }}（{{ group.players.length }} 人）</header>
          <ol>
            <li v-for="player in group.players" :key="player">{{ player }}</li>
          </ol>
        </section>
      </div>
    </el-dialog>
  </section>
</template>

<style scoped>
.tournament-layout {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 26px;
  align-items: start;
}

.publish-panel,
.list-panel {
  margin-top: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.refresh-note {
  font-size: 12px;
  color: color-mix(in srgb, #19212e 60%, #3268b8 40%);
}

.tournament-list {
  display: grid;
  gap: 16px;
  margin-top: 12px;
}

.tournament-card {
  border: 1px solid color-mix(in srgb, #19212e 12%, transparent);
  border-radius: 8px;
  padding: 16px 18px;
  background: color-mix(in srgb, #ffffff 70%, #dfe8f4 30%);
  display: grid;
  gap: 12px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-title {
  font-size: 17px;
  display: block;
}

.card-sub {
  font-size: 13px;
  color: color-mix(in srgb, #19212e 65%, #3268b8 35%);
}

.seat-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
}

.seat-text {
  font-size: 13px;
  white-space: nowrap;
}

.seat-empty {
  color: #cf5c36;
}

.player-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.player-label {
  font-size: 13px;
  color: color-mix(in srgb, #19212e 65%, #3268b8 35%);
}

.player-tag {
  margin-right: 2px;
}

.player-empty {
  font-size: 13px;
  color: color-mix(in srgb, #19212e 45%, transparent);
}

.card-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.register-input {
  max-width: 240px;
}

.dialog-note {
  margin-top: 0;
  color: color-mix(in srgb, #19212e 65%, #3268b8 35%);
  font-size: 13px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.group-card {
  border: 1px solid color-mix(in srgb, #3268b8 30%, transparent);
  border-radius: 8px;
  padding: 10px 14px;
}

.group-card header {
  font-weight: 700;
  margin-bottom: 6px;
}

.group-card ol {
  margin: 0;
  padding-left: 20px;
  line-height: 1.9;
}

@media (max-width: 960px) {
  .tournament-layout {
    grid-template-columns: 1fr;
  }
}
</style>
