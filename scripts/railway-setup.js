const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const configPaths = [
  path.join(process.env.USERPROFILE, '.railway', 'config.json'),
  path.join(process.env.APPDATA || '', 'railway', 'config.json'),
  path.join(process.env.USERPROFILE, '.config', 'railway', 'config.json'),
];

let token = null;
for (const p of configPaths) {
  if (fs.existsSync(p)) {
    const config = JSON.parse(fs.readFileSync(p, 'utf8'));
    token = config.user?.accessToken || config.user?.token || config.token;
    if (token) { console.log('Token encontrado en:', p); break; }
  }
}

if (!token) {
  console.error('Token no encontrado. Ejecuta railway login primero.');
  process.exit(1);
}

async function gql(query, variables = {}) {
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function main() {
  // 1. Listar proyectos
  const { me } = await gql(`query {
    me {
      projects {
        edges { node {
          id name
          services { edges { node { id name } } }
          environments { edges { node { id name } } }
        }}
      }
    }
  }`);

  const projects = me.projects.edges;
  console.log('Proyectos encontrados:', projects.map(p => p.node.name).join(', '));

  const portalProject = projects.find(p =>
    p.node.name.toLowerCase().includes('portal')
  );
  if (!portalProject) {
    console.error('No se encontró proyecto "portal". Proyectos:', projects.map(p => p.node.name));
    process.exit(1);
  }

  const projectId     = portalProject.node.id;
  const serviceNode   = portalProject.node.services.edges[0]?.node;
  const serviceId     = serviceNode?.id;
  const envNode       = portalProject.node.environments.edges
    .find(e => e.node.name === 'production') || portalProject.node.environments.edges[0];
  const environmentId = envNode?.node.id;

  console.log('✅ Proyecto:     ', portalProject.node.name);
  console.log('✅ Project ID:   ', projectId);
  console.log('✅ Service:      ', serviceNode?.name, '|', serviceId);
  console.log('✅ Environment:  ', envNode?.node.name, '|', environmentId);

  // 2. Upsert variables
  const vars = [
    { name: 'TEST_MODE',          value: 'true' },
    { name: 'TEST_ACCESS_TOKEN',  value: 'APP_USR-7164966151403526-052022-eada6fd7dae1729ddc03c34466016d53-3416957718' },
    { name: 'TEST_PUBLIC_KEY',    value: 'APP_USR-d5a2ce9b-861c-419b-b7d8-3e1757e93e96' },
  ];

  for (const v of vars) {
    await gql(`mutation variableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }`, { input: { projectId, serviceId, environmentId, name: v.name, value: v.value } });
    console.log(`✅ Variable configurada: ${v.name}=${v.value.substring(0, 20)}...`);
  }

  // 3. Redeploy
  try {
    await gql(`mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`, { serviceId, environmentId });
    console.log('✅ Redeploy iniciado');
  } catch (err) {
    console.warn('⚠️  Redeploy mutation falló (puede ser nombre distinto):', err.message.substring(0, 120));
    console.log('   El redeploy se disparará automáticamente al detectar variables nuevas.');
  }

  console.log('\n══════════════════════════════════');
  console.log('✅ VARIABLES CONFIGURADAS EN RAILWAY');
  console.log('⏳ Espera ~2 minutos y corre: node scripts/verify-live-test.js');
  console.log('══════════════════════════════════\n');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
