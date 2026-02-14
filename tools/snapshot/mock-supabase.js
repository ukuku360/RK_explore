(() => {
  function makeUser(overrides) {
    return Object.assign({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'member@example.com',
      created_at: '2025-12-01T00:00:00.000Z',
      email_confirmed_at: '2025-12-01T00:00:00.000Z',
      user_metadata: { nickname: 'Member' }
    }, overrides || {});
  }

  function createScenarioData(name) {
    const basePostId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const hiddenPostId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const basePost = {
      id: basePostId,
      location: 'Bondi Beach',
      author: 'Member',
      user_id: '11111111-1111-1111-1111-111111111111',
      proposed_date: '2026-03-10',
      category: 'Travel',
      status: 'proposed',
      capacity: 2,
      meetup_place: 'Central Lobby',
      meeting_time: '09:30:00',
      estimated_cost: 35,
      prep_notes: 'Bring sunscreen and water.',
      rsvp_deadline: '2026-03-09T09:00:00.000Z',
      is_hidden: false,
      hidden_reason: null,
      hidden_by: null,
      hidden_at: null,
      created_at: '2026-02-10T08:00:00.000Z'
    };

    const hiddenPost = {
      id: hiddenPostId,
      location: 'Secret Meetup',
      author: 'Other User',
      user_id: '33333333-3333-3333-3333-333333333333',
      proposed_date: '2026-03-15',
      category: 'Extra',
      status: 'proposed',
      capacity: 10,
      meetup_place: null,
      meeting_time: null,
      estimated_cost: null,
      prep_notes: null,
      rsvp_deadline: null,
      is_hidden: true,
      hidden_reason: 'Spam content',
      hidden_by: '22222222-2222-2222-2222-222222222222',
      hidden_at: '2026-02-12T10:00:00.000Z',
      created_at: '2026-02-11T08:00:00.000Z'
    };

    const votes = [
      { id: 'v1', post_id: basePostId, user_id: '11111111-1111-1111-1111-111111111111', created_at: '2026-02-10T08:05:00.000Z' }
    ];

    const rsvps = [
      { id: 'r1', post_id: basePostId, user_id: '11111111-1111-1111-1111-111111111111', created_at: '2026-02-10T08:06:00.000Z' },
      { id: 'r2', post_id: basePostId, user_id: '44444444-4444-4444-4444-444444444444', created_at: '2026-02-10T08:07:00.000Z' },
      { id: 'r3', post_id: basePostId, user_id: '55555555-5555-5555-5555-555555555555', created_at: '2026-02-10T08:08:00.000Z' }
    ];

    const comments = [
      {
        id: 'c1',
        post_id: basePostId,
        user_id: '44444444-4444-4444-4444-444444444444',
        author: 'Alex',
        text: 'Count me in!',
        created_at: '2026-02-10T08:10:00.000Z'
      }
    ];

    const reports = [
      {
        id: 'rp1',
        post_id: hiddenPostId,
        reporter_user_id: '11111111-1111-1111-1111-111111111111',
        reporter_email: 'member@example.com',
        reason: 'Looks like spam',
        status: 'open',
        created_at: '2026-02-13T02:00:00.000Z',
        reviewed_by: null,
        reviewed_at: null
      }
    ];

    const logs = [
      {
        id: 'l1',
        post_id: hiddenPostId,
        report_id: 'rp1',
        action: 'hide',
        reason: 'Spam pattern',
        admin_user_id: '22222222-2222-2222-2222-222222222222',
        admin_email: 'swanston@roomingkos.com',
        created_at: '2026-02-13T03:00:00.000Z'
      }
    ];

    if (name === 'login') {
      return {
        session: null,
        tables: { posts: [], votes: [], rsvps: [], comments: [], post_reports: [], admin_action_logs: [] }
      };
    }

    if (name === 'admin') {
      return {
        session: {
          user: makeUser({
            id: '22222222-2222-2222-2222-222222222222',
            email: 'swanston@roomingkos.com',
            user_metadata: { nickname: 'Admin Swan' }
          })
        },
        tables: {
          posts: [basePost, hiddenPost],
          votes,
          rsvps,
          comments,
          post_reports: reports,
          admin_action_logs: logs
        }
      };
    }

    return {
      session: { user: makeUser() },
      tables: {
        posts: [basePost],
        votes,
        rsvps,
        comments,
        post_reports: [],
        admin_action_logs: []
      }
    };
  }

  function makeSelectQuery(rows) {
    let current = Array.isArray(rows) ? rows.slice() : [];

    const query = {
      select() {
        return query;
      },
      in(column, values) {
        const set = new Set(Array.isArray(values) ? values : []);
        current = current.filter((row) => set.has(row[column]));
        return query;
      },
      eq(column, value) {
        current = current.filter((row) => row[column] === value);
        return query;
      },
      order(column, options) {
        const ascending = !options || options.ascending !== false;

        current = current.slice().sort((a, b) => {
          const va = a[column] == null ? '' : a[column];
          const vb = b[column] == null ? '' : b[column];

          if (va === vb) return 0;
          return va > vb ? 1 : -1;
        });

        if (!ascending) current.reverse();
        return query;
      },
      limit(count) {
        current = current.slice(0, count);
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: current, error: null }).then(resolve, reject);
      }
    };

    return query;
  }

  function makeMutationResult() {
    return Promise.resolve({ data: null, error: null });
  }

  function createClient() {
    const scenarioName = window.__RK_MOCK_SCENARIO || 'login';
    const scenario = createScenarioData(scenarioName);
    const tables = scenario.tables;

    return {
      auth: {
        getSession() {
          return Promise.resolve({ data: { session: scenario.session }, error: null });
        },
        signInWithPassword() {
          return Promise.resolve({ data: { user: scenario.session ? scenario.session.user : null }, error: null });
        },
        signUp() {
          return Promise.resolve({ data: null, error: null });
        },
        signOut() {
          return Promise.resolve({ error: null });
        }
      },
      from(table) {
        return {
          select() {
            return makeSelectQuery(tables[table] || []);
          },
          insert() {
            return makeMutationResult();
          },
          update() {
            return {
              eq() {
                return makeMutationResult();
              }
            };
          },
          delete() {
            return {
              eq() {
                return makeMutationResult();
              },
              match() {
                return makeMutationResult();
              }
            };
          }
        };
      },
      channel() {
        const chain = {
          on() {
            return chain;
          },
          subscribe(callback) {
            if (typeof callback === 'function') {
              setTimeout(() => callback('SUBSCRIBED'), 10);
            }
            return chain;
          }
        };

        return chain;
      }
    };
  }

  window.supabase = {
    createClient
  };
})();
