<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  createTournament,
  fetchTournaments,
  registerPlayer,
} from "../api/client";
import { BOARD_GAMES, TOURNAMENT_POLL_INTERVAL } from "../constants/tournaments";
import type { CreateTournamentPayload, Tournament } from "../types";

const tournaments = ref<Tournament[]>([]);
const loadError = ref("");

const publishVisible = ref(false);
const publishSubmitting = ref(false);
const publishForm = reactive<CreateTournamentPayload>({
  name: "",
  game: BOARD_GAMES[0],
  startTime: "",
  capacity: 8,
  groupSize: 4,
});

const registerVisible = ref(false);
const registerSubmitting = ref(false);
const registerTarget = ref<Tournament | null>(null);
const playerName = ref("");

const groupsVisible = ref(false);
const groupsTarget = ref<Tournament | null>(null);

let poller: ReturnType<typeof setInterval> | undefined;

const sortedTournaments = computed(() =>
  [...tournaments.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
);

const registerDialogTitle = computed(() =>
  registerTarget.value ? `报名：${registerTarget.value.name}` : "报名",
);

const groupsDialogTitle = computed(() => {
  const target = groupsTarget.value;
  if (!target) {
    return "赛事详情";
  }
  return target.status === "locked" ? `分组结果：${target.name}` : `报名名单：${target.name}`;
});

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

async function refreshTournaments() {
  try {
    tournaments.value = await fetchTournaments();
    loadError.value = "";
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "赛事数据加载失败";
  }
}

function openPublish() {
  publishForm.name = "";
  publishForm.game = BOARD_GAMES[0];
  publishForm.startTime = "";
  publishForm.capacity = 8;
  publishForm.groupSize = 4;
  publishVisible.value = true;
}

async function submitPublish() {
  if (!publishForm.name.trim()) {
    ElMessage.warning("请填写赛事名称");
    return;
  }
  if (!publishForm.startTime) {
    ElMessage.warning("请选择开始时间");
    return;
  }
  if (publishForm.groupSize > publishForm.capacity) {
    ElMessage.warning("每组人数不能大于人数上限");
    return;
  }
  publishSubmitting.value = true;
  try {
    await createTournament({
      ...publishForm,
      name: publishForm.name.trim(),
      startTime: new Date(publishForm.startTime).toISOString(),
    });
    publishVisible.value = false;
    ElMessage.success("赛事已发布");
    await refreshTournaments();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "发布失败");
  } finally {
    publishSubmitting.value = false;
  }
}

function openRegister(tournament: Tournament) {
  registerTarget.value = tournament;
  playerName.value = "";
  registerVisible.value = true;
}

async function submitRegister() {
  const tournament = registerTarget.value;
  if (!tournament) {
    return;
  }
  const name = playerName.value.trim();
  if (!name) {
    ElMessage.warning("请填写玩家昵称");
    return;
  }
  registerSubmitting.value = true;
  try {
    const updated = await registerPlayer(tournament.id, name);
    if (updated.status === "locked") {
      ElMessage.success("报名成功，赛事已满员并自动完成分组");
    } else {
      ElMessage.success(`报名成功，剩余名额 ${updated.remaining}`);
    }
    registerVisible.value = false;
    await refreshTournaments();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "报名失败");
    await refreshTournaments();
  } finally {
    registerSubmitting.value = false;
  }
}

function openGroups(tournament: Tournament) {
  groupsTarget.value = tournament;
  groupsVisible.value = true;
}

onMounted(async () => {
  await refreshTournaments();
  poller = setInterval(refreshTournaments, TOURNAMENT_POLL_INTERVAL);
});

onBeforeUnmount(() => {
  if (poller) {
    clearInterval(poller);
  }
});
</script>

<template>
  <section class="work-panel tournament-panel" aria-label="赛事活动">
    <div class="panel-head">
      <div>
        <h2>赛事活动</h2>
        <p class="panel-sub">门店发布比赛，玩家报名参赛，满员后系统自动轮流分组并锁定报名。</p>
      </div>
      <el-button type="primary" @click="openPublish">发布赛事</el-button>
    </div>

    <el-alert
      v-if="loadError"
      :title="`赛事数据加载失败：${loadError}`"
      type="error"
      :closable="false"
      show-icon
    />

    <el-empty v-if="!loadError && sortedTournaments.length === 0" description="暂无赛事，点击右上角发布第一场吧" />

    <div v-else class="tournament-grid">
      <article v-for="item in sortedTournaments" :key="item.id" class="tournament-card">
        <div class="card-head">
          <strong>{{ item.name }}</strong>
          <el-tag :type="item.status === 'open' ? 'success' : 'info'" size="small">
            {{ item.status === "open" ? "报名中" : "已锁定" }}
          </el-tag>
        </div>
        <p class="card-meta">{{ item.game }} · {{ formatTime(item.startTime) }}</p>
        <div class="card-stats">
          <span>上限 {{ item.capacity }} 人</span>
          <span>每组 {{ item.groupSize }} 人</span>
          <span>已报 {{ item.registeredCount }} 人</span>
          <span class="remaining">剩余 {{ item.remaining }} 席</span>
        </div>
        <el-progress
          :percentage="Math.round((item.registeredCount / item.capacity) * 100)"
          :status="item.status === 'locked' ? 'success' : undefined"
        />
        <div class="card-actions">
          <el-button
            type="primary"
            size="small"
            :disabled="item.status !== 'open' || item.remaining <= 0"
            @click="openRegister(item)"
          >
            {{ item.status === "locked" ? "已锁定" : "立即报名" }}
          </el-button>
          <el-button size="small" @click="openGroups(item)">
            {{ item.status === "locked" ? "查看分组" : "报名名单" }}
          </el-button>
        </div>
      </article>
    </div>

    <el-dialog v-model="publishVisible" title="发布赛事" width="420px">
      <el-form label-width="90px">
        <el-form-item label="赛事名称">
          <el-input v-model="publishForm.name" maxlength="60" placeholder="如：周五狼人杀锦标赛" />
        </el-form-item>
        <el-form-item label="桌游">
          <el-select v-model="publishForm.game" style="width: 100%">
            <el-option v-for="game in BOARD_GAMES" :key="game" :label="game" :value="game" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="publishForm.startTime"
            type="datetime"
            style="width: 100%"
            placeholder="选择开始时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="人数上限">
          <el-input-number v-model="publishForm.capacity" :min="2" :max="512" />
        </el-form-item>
        <el-form-item label="每组人数">
          <el-input-number v-model="publishForm.groupSize" :min="2" :max="64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" :loading="publishSubmitting" @click="submitPublish">发布</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="registerVisible"
      :title="registerDialogTitle"
      width="380px"
    >
      <p v-if="registerTarget" class="dialog-tip">
        当前剩余 {{ registerTarget.remaining }} 席，先到先得。
      </p>
      <el-input
        v-model="playerName"
        maxlength="40"
        placeholder="输入玩家昵称"
        @keyup.enter="submitRegister"
      />
      <template #footer>
        <el-button @click="registerVisible = false">取消</el-button>
        <el-button type="primary" :loading="registerSubmitting" @click="submitRegister">
          确认报名
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="groupsVisible"
      :title="groupsDialogTitle"
      width="480px"
    >
      <template v-if="groupsTarget">
        <template v-if="groupsTarget.status === 'locked'">
          <div class="group-grid">
            <div v-for="group in groupsTarget.groups" :key="group.name" class="group-box">
              <strong>{{ group.name }}（{{ group.players.length }} 人）</strong>
              <ol>
                <li v-for="player in group.players" :key="player">{{ player }}</li>
              </ol>
            </div>
          </div>
        </template>
        <template v-else>
          <el-empty
            v-if="groupsTarget.players.length === 0"
            description="还没有玩家报名"
          />
          <ol v-else class="player-order">
            <li v-for="(player, index) in groupsTarget.players" :key="player">
              第 {{ index + 1 }} 位：{{ player }}
            </li>
          </ol>
          <p class="dialog-tip">满员后系统将按报名顺序轮流分组，组间人数差不超过 1 人。</p>
        </template>
      </template>
    </el-dialog>
  </section>
</template>
