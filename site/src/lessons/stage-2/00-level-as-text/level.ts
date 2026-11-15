export const LEVEL = `# Manifold level 1
# One piece per line; a line that starts with # is a comment.
# Sizes are HALF sizes: "1 0.5 2" is a box 2 x 1 x 4 m.
title A small yard
spawn -3 3.5 -1
facing 0 0 1

# The floor: 14 x 1 x 14 m, its top at y = 0.
box 0 -0.5 0   7 0.5 7   color #6f6a62
# A platform 1.6 m high, and a ramp down from it.
box -3 0.8 -3   1.5 0.8 1.5   color #8a6a42
box -3 0.7 0.7   1 0.1 2.4   rotate x 20   color #9a7a52
# Three steps of 30 cm.
box 3 0.15 1    1 0.15 0.5   color #7d776e
box 3 0.3 0     1 0.3 0.5    color #7d776e
box 3 0.45 -1   1 0.45 0.5   color #7d776e
# A low wall at the end, so that nothing rolls off.
box 0 0.4 6.5   7 0.4 0.25   color #5a544c

# Zones push nothing. Here they are only drawn.
sensor checkpoint  -3 2.2 -3   1.5 0.6 1.5
sensor goal        -3 0.6 5    1.5 0.6 1.2
`;
