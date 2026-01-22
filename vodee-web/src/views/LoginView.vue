<template>
  <div class="login-container dark-mode">
    <div class="login-background">
      <div class="login-content">
        <el-card class="login-card" shadow="always">
          <template #header>
            <div class="card-header">
              <h2>VODEE</h2>
            </div>
          </template>

          <el-form
            :model="form"
            :rules="rules"
            ref="loginForm"
            @submit.prevent="handleLogin"
            label-width="80px"
          >
            <el-form-item label="用户名" prop="username" size="small">
              <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" />
            </el-form-item>

            <el-form-item label="密码" prop="password" size="small" style="margin-top: 30px">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                prefix-icon="Lock"
                show-password
              />
            </el-form-item>

            <el-form-item style="margin-top: 30px">
              <el-button
                type="primary"
                size="small"
                @click="handleLogin"
                :loading="loading"
                :icon="loading ? Loading : Key"
                style="height: 35px;"
                class="login-button"
              >
                {{ loading ? '登录中...' : '立即登录' }}
              </el-button>
            </el-form-item>
          </el-form>

          <div v-if="errorMessage" class="error-message">
            <el-alert :title="errorMessage" type="error" show-icon />
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { Key, Loading } from '@element-plus/icons-vue'

const router = useRouter()
const loginForm = ref<FormInstance>()
const loading = ref(false)
const errorMessage = ref('')

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' },
  ],
}

const handleLogin = async () => {
  if (!loginForm.value) return

  try {
    const valid = await loginForm.value.validate()
    if (!valid) return

    loading.value = true
    errorMessage.value = ''

    // 模拟登录验证
    setTimeout(() => {
      if (form.username === 'admin' && form.password === '123456') {
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('username', form.username)
        router.push('/main')
      } else {
        errorMessage.value = '用户名或密码错误！'
      }
      loading.value = false
    }, 1000)
  } catch (error) {
    loading.value = false
  }
}

onMounted(() => {
  // 设置暗黑模式
  document.documentElement.classList.add('dark')
})
</script>

<style scoped>
.login-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #141414;
}

.login-background {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #741d1d 0%, #2d2d2d 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.login-content {
  width: auto;
  max-width: 400px;
  min-width: 350px;
  display: flex;
  justify-content: center;
}

.login-card {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  background-color: #1f1f1f;
  border: 1px solid #434343;
}

.card-header {
  text-align: center;
  /* border-bottom: 1px solid #434343; */
}

.card-header h2 {
  margin: 0;
  color: #e5eaf3;
  font-size: 22px;
  font-weight: 600;
}

.login-button {
  width: 100%;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #409eff, #337ecc);
  border: none;
}

.login-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.login-button:active {
  transform: translateY(0);
}

.error-message {
  margin-top: 10px;
}

/* 暗黑模式下的表单样式 */
:deep(.el-form-item__label) {
  color: #c9cdd4 !important;
}

:deep(.el-input__inner) {
  background-color: #2d2d2d !important;
  border-color: #434343 !important;
  color: #c9cdd4 !important;
}

:deep(.el-input__inner::placeholder) {
  color: #909399 !important;
}

:deep(.el-input__prefix) {
  color: #909399 !important;
}

/* 响应式设计 - 小屏幕 */
@media (max-width: 480px) {
  .login-background {
    padding: 15px;
  }

  .login-content {
    min-width: 280px;
    max-width: 350px;
  }

  .card-header h2 {
    font-size: 18px;
  }

  .login-button {
    height: 44px;
    font-size: 12px;
  }
}

@media (max-width: 768px) {
  .login-background {
    padding: 20px;
  }

  .login-content {
    min-width: 300px;
    max-width: 400px;
  }
}

/* 高分辨率优化 */
@media (min-width: 1920px) {
  .login-background {
    padding: 60px;
  }

  .login-content {
    max-width: 550px;
  }

  .card-header h2 {
    font-size: 24px;
  }

  .login-button {
    height: 52px;
    font-size: 14px;
  }
}

@media (min-width: 2560px) {
  .login-background {
    padding: 80px;
  }

  .login-content {
    max-width: 600px;
  }

  .card-header h2 {
    font-size: 24px;
  }

  .login-button {
    height: 56px;
    font-size: 18px;
  }
}

/* 暗黑模式下的滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #2d2d2d;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>
